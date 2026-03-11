import type { PuzzleState, LoadedRule } from '$lib/model/types';
import { compilePuzzle, type ValueChoice } from './compiler';
import { solveAllTimed, solveForSolution } from './worker';
import {
	buildVariableSpaces,
	initUnknowns,
	harvestSolution as harvestSolutionGeneric,
	buildCandidateResult,
	type Candidate,
} from './variable-spaces';

export interface CandidateResult {
	/** For each cell [row][col], the set of possible values */
	numbers?: number[][][];
	/** For each cell [row][col], true/false/both */
	shading?: ('true' | 'false' | 'both' | null)[][];
	/** Border candidates for horizontal/vertical edges */
	borderH?: ('true' | 'false' | 'both' | null)[][];
	borderV?: ('true' | 'false' | 'both' | null)[][];
	/** Line candidates for horizontal/vertical edges */
	lineH?: number[][][];
	lineV?: number[][][];
}

export interface CandidateProgress {
	phase: 'sampling' | 'eliminating';
	completed: number;
	total: number;
}

/** Sampling pass configuration */
export interface SamplingPass {
	/** Fraction of total sampling budget (0-1). Fractions are normalized. */
	weight: number;
	/** Value choice strategy, or undefined for plain solve satisfy */
	valueChoice?: ValueChoice;
}

/** Full configuration for the candidates algorithm */
export interface CandidateConfig {
	/** Total time budget for all sampling passes (ms) */
	samplingBudgetMs: number;
	/** Sampling passes to run in order. Default: 70% plain, 10% each min/max/median */
	passes: SamplingPass[];
	/** Max batch size for adaptive OR elimination (batch grows on UNSAT, shrinks on SAT) */
	maxBatchSize: number;
}

export const DEFAULT_CONFIG: CandidateConfig = {
	samplingBudgetMs: 5000,
	passes: [
		{ weight: 7, valueChoice: undefined },
		{ weight: 1, valueChoice: 'indomain_min' },
		{ weight: 1, valueChoice: 'indomain_max' },
		{ weight: 1, valueChoice: 'indomain_median' },
	],
	maxBatchSize: 16,
};

/**
 * Find true candidates using optimized algorithm:
 * 1. Multi-pass sampling with different search strategies
 * 2. If any pass completes all solutions, return union directly
 * 3. Otherwise, batch-eliminate remaining unknowns with OR clauses
 */
export async function findTrueCandidates(
	puzzle: PuzzleState,
	rules: LoadedRule[],
	onProgress?: (progress: CandidateProgress) => void,
	signal?: AbortSignal,
	solver: string = 'gecode',
	config: CandidateConfig = DEFAULT_CONFIG,
): Promise<CandidateResult> {
	const normalModel = compilePuzzle(puzzle, rules);

	// Compile models for each unique pass strategy
	const passModels = new Map<string, string>();
	passModels.set('default', normalModel);
	for (const pass of config.passes) {
		const key = pass.valueChoice ?? 'default';
		if (!passModels.has(key)) {
			passModels.set(key, compilePuzzle(puzzle, rules, { valueChoice: pass.valueChoice }));
		}
	}

	// Build variable space descriptors and initialize unknown tracking
	const spaces = buildVariableSpaces(puzzle);
	const { possibles, allCandidates } = initUnknowns(spaces);

	const totalUnknowns = allCandidates.length;

	// --- Step 1: Time-bounded solveAll with random search ---
	onProgress?.({ phase: 'sampling', completed: 0, total: totalUnknowns });

	function harvest(sol: Record<string, unknown>): void {
		harvestSolutionGeneric(spaces, possibles, sol);
	}

	// Track candidates proven impossible (UNSAT)
	const impossible = new Set<Candidate>();

	// Helpers
	function getUnknowns(): Candidate[] {
		return allCandidates.filter((c) => !impossible.has(c) && !possibles.get(c.key)?.has(c.value));
	}

	function getUnknownCount(): number {
		let count = 0;
		for (const c of allCandidates) {
			if (!impossible.has(c) && !possibles.get(c.key)?.has(c.value)) count++;
		}
		return count;
	}

	const t0 = performance.now();
	let totalSolutionCount = 0;
	let allSolutionsFound = false;

	// --- Step 1: Multi-pass sampling ---
	// Normalize pass weights to compute per-pass time budgets
	const totalWeight = config.passes.reduce((s, p) => s + p.weight, 0);

	for (let i = 0; i < config.passes.length; i++) {
		if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

		const pass = config.passes[i];
		const passTimeMs = Math.round((pass.weight / totalWeight) * config.samplingBudgetMs);
		if (passTimeMs < 100) continue; // skip negligible passes

		const passKey = pass.valueChoice ?? 'default';
		const model = passModels.get(passKey)!;

		let passCount = 0;
		const pt0 = performance.now();
		const result = await solveAllTimed(
			model,
			passTimeMs,
			(sol) => { passCount++; totalSolutionCount++; harvest(sol); },
			solver,
			signal
		);
		const pt1 = performance.now();

		const resolved = totalUnknowns - getUnknownCount();
		console.log(
			`[candidates] pass ${i + 1}/${config.passes.length} (${passKey}): ` +
			`${pt1 - pt0 | 0}ms, ${passCount} solutions, ` +
			`${resolved}/${totalUnknowns} resolved`
		);

		onProgress?.({ phase: 'sampling', completed: resolved, total: totalUnknowns });

		if (result.completed) {
			allSolutionsFound = true;
			break;
		}
	}

	const t1 = performance.now();
	console.log(
		`[candidates] sampling total: ${t1 - t0 | 0}ms, ` +
		`${totalSolutionCount} solutions, complete=${allSolutionsFound}`
	);

	if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

	// --- Step 2: If all solutions found, we're done ---
	if (allSolutionsFound) {
		console.log(`[candidates] total: ${performance.now() - t0 | 0}ms (sampling only)`);
		return buildCandidateResult(spaces, possibles);
	}

	// --- Step 3: Batch elimination of remaining unknowns ---
	let unknowns = getUnknowns();
	onProgress?.({ phase: 'eliminating', completed: totalUnknowns - unknowns.length, total: totalUnknowns });

	let batchCount = 0;
	let satCount = 0;
	let unsatCount = 0;
	let currentBatchSize = 1; // Start small — early unknowns are likely SAT

	console.log(`[candidates] starting elimination: ${unknowns.length} unknowns remaining`);

	while (unknowns.length > 0) {
		if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

		const batch = unknowns.slice(0, currentBatchSize);
		batchCount++;

		// Build OR constraint and append to normal model (MiniZinc allows extra constraints)
		const batchDesc = batch.map((c) => `${c.varExpr}=${c.value}`).join(' | ');
		const orParts = batch.map((c) => `(${c.varExpr} = ${c.value})`);
		const orConstraint = `\nconstraint ${orParts.join(' \\/ ')};`;
		const testModel = normalModel + orConstraint;

		const bt0 = performance.now();
		const sol = await solveForSolution(testModel, solver);
		const bt1 = performance.now();

		const prevUnknowns = unknowns.length;
		if (sol) {
			satCount++;
			harvest(sol);
			unknowns = getUnknowns();
			const eliminated = prevUnknowns - unknowns.length;
			currentBatchSize = Math.max(1, currentBatchSize - 1);
			console.log(
				`[batch ${batchCount}, size=${batch.length}] SAT in ${bt1 - bt0 | 0}ms, ` +
				`resolved ${eliminated} unknowns (${unknowns.length} left). ` +
				`Tested: ${batchDesc}`
			);
		} else {
			unsatCount++;
			for (const c of batch) impossible.add(c);
			unknowns = getUnknowns();
			const eliminated = prevUnknowns - unknowns.length;
			currentBatchSize = Math.min(unknowns.length, config.maxBatchSize, currentBatchSize + 1);
			console.log(
				`[batch ${batchCount}, size=${batch.length}] UNSAT in ${bt1 - bt0 | 0}ms, ` +
				`eliminated ${eliminated} impossible (${unknowns.length} left). ` +
				`Tested: ${batchDesc}`
			);
		}

		const newResolved = totalUnknowns - unknowns.length;
		onProgress?.({ phase: 'eliminating', completed: newResolved, total: totalUnknowns });
	}

	const t2 = performance.now();
	console.log(
		`[candidates] elimination: ${t2 - t1 | 0}ms, ` +
		`${batchCount} batches (${satCount} SAT, ${unsatCount} UNSAT), ` +
		`maxBatchSize=${config.maxBatchSize}`
	);
	console.log(`[candidates] total: ${t2 - t0 | 0}ms`);

	return buildCandidateResult(spaces, possibles);
}

