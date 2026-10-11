import type { PuzzleState, LoadedRule } from '$lib/model/types';
import { compilePuzzle, type ValueChoice } from './compiler';
import { solveAllTimed, solveForSolution, solveTrueCandidates } from './worker';
import {
	buildVariableSpaces,
	initUnknowns,
	harvestSolution as harvestSolutionGeneric,
	buildCandidateResult,
	type Candidate,
} from './variable-spaces';

export type NumericCandidateGrid = number[][][];
export type BooleanCandidateGrid = ('true' | 'false' | 'both' | null)[][];

export interface CandidateResult {
	/** Per-variable candidate grids, keyed by MZN array name (VariableSpace.solField) */
	grids: Record<string, NumericCandidateGrid | BooleanCandidateGrid>;
	/** Total number of solutions seen during candidate computation */
	solutionCount?: number;
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
}

export const DEFAULT_CONFIG: CandidateConfig = {
	samplingBudgetMs: 5000,
	passes: [
		{ weight: 7, valueChoice: undefined },
		{ weight: 1, valueChoice: 'indomain_min' },
		{ weight: 1, valueChoice: 'indomain_max' },
		{ weight: 1, valueChoice: 'indomain_median' },
	],
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
	// Native Chuffed path: solver handles novelty internally, one flatten only
	if (solver === 'chuffed') {
		return findTrueCandidatesNative(puzzle, rules, onProgress, signal);
	}

	// [profile] compile timing
	const compileT0 = performance.now();
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
	const compileMs = performance.now() - compileT0;
	console.log(`[candidates profile] compile: ${compileMs | 0}ms (${passModels.size} models)`);

	// Build variable space descriptors and initialize unknown tracking
	const spaces = buildVariableSpaces(puzzle);
	const { possibles, allCandidates } = initUnknowns(spaces);

	const totalUnknowns = allCandidates.length;

	// --- Step 1: Time-bounded solveAll with random search ---
	onProgress?.({ phase: 'sampling', completed: 0, total: totalUnknowns });

	function harvest(sol: Record<string, unknown>): void {
		harvestSolutionGeneric(spaces, possibles, sol);
	}

	// Helpers
	function getUnknowns(): Candidate[] {
		return allCandidates.filter((c) => !possibles.get(c.key)?.has(c.value));
	}

	function getUnknownCount(): number {
		let count = 0;
		for (const c of allCandidates) {
			if (!possibles.get(c.key)?.has(c.value)) count++;
		}
		return count;
	}

	const t0 = performance.now();
	let totalSolutionCount = 0;
	let allSolutionsFound = false;

	// [profile] phase accumulators
	let samplingHarvestMs = 0;
	let samplingWallMs = 0;
	let noveltySolveMs = 0;
	let noveltyHarvestMs = 0;
	let noveltyOverheadMs = 0;
	// [profile] MiniZinc-internal stats (flatTime + solveTime are reported in seconds)
	let samplingFlatMs = 0;
	let samplingMznSolveMs = 0;
	let noveltyFlatMs = 0;
	let noveltyMznSolveMs = 0;
	function accStats(target: 'sampling' | 'novelty', stats: Record<string, unknown>): void {
		const flat = typeof stats.flatTime === 'number' ? stats.flatTime * 1000 : 0;
		const solveT = typeof stats.solveTime === 'number' ? stats.solveTime * 1000 : 0;
		if (target === 'sampling') {
			samplingFlatMs += flat;
			samplingMznSolveMs += solveT;
		} else {
			noveltyFlatMs += flat;
			noveltyMznSolveMs += solveT;
		}
	}

	// --- Step 1: Multi-pass sampling ---
	// Normalize pass weights to compute per-pass time budgets
	const totalWeight = config.passes.reduce((s, p) => s + p.weight, 0);

	// Local abort controller so we can cancel sampling early when all unknowns resolve
	const samplingController = new AbortController();
	if (signal) {
		signal.addEventListener('abort', () => samplingController.abort(), { once: true });
	}

	for (let i = 0; i < config.passes.length; i++) {
		if (samplingController.signal.aborted) break;

		const pass = config.passes[i];
		const passTimeMs = Math.round((pass.weight / totalWeight) * config.samplingBudgetMs);
		if (passTimeMs < 100) continue; // skip negligible passes

		const passKey = pass.valueChoice ?? 'default';
		const model = passModels.get(passKey)!;

		let passCount = 0;
		let passHarvestMs = 0;
		const pt0 = performance.now();
		const result = await solveAllTimed(
			model,
			passTimeMs,
			(sol) => {
				passCount++;
				totalSolutionCount++;
				const h0 = performance.now();
				harvest(sol);
				const allResolved = getUnknownCount() === 0;
				passHarvestMs += performance.now() - h0;
				if (allResolved) {
					samplingController.abort();
				}
			},
			solver,
			samplingController.signal,
			(stats) => accStats('sampling', stats),
		);
		const pt1 = performance.now();
		samplingHarvestMs += passHarvestMs;
		samplingWallMs += pt1 - pt0;

		const resolved = totalUnknowns - getUnknownCount();
		console.log(
			`[candidates] pass ${i + 1}/${config.passes.length} (${passKey}): ` +
			`${pt1 - pt0 | 0}ms, ${passCount} solutions, ` +
			`${resolved}/${totalUnknowns} resolved`
		);

		onProgress?.({ phase: 'sampling', completed: resolved, total: totalUnknowns });

		if (result.completed || getUnknownCount() === 0) {
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
		console.table({
			'js.compile': { ms: compileMs | 0 },
			'sampling.solve': { ms: (samplingWallMs - samplingHarvestMs) | 0 },
			'  └ mzn.flatten': { ms: samplingFlatMs | 0 },
			'  └ mzn.solve': { ms: samplingMznSolveMs | 0 },
			'sampling.harvest': { ms: samplingHarvestMs | 0 },
			total: { ms: (performance.now() - t0) | 0 },
		});
		return buildCandidateResult(spaces, possibles);
	}

	// --- Step 3: Novelty constraint loop for remaining unknowns ---
	// Each iteration builds an OR of ALL unknowns: "the solution must contain
	// at least one candidate I haven't confirmed yet."
	// SAT → harvest (resolves many unknowns at once), repeat with fewer unknowns.
	// UNSAT → no solution uses ANY remaining unknown. All are false. Done.
	let unknowns = getUnknowns();
	onProgress?.({ phase: 'eliminating', completed: totalUnknowns - unknowns.length, total: totalUnknowns });

	let iterCount = 0;

	if (unknowns.length > 0) {
		console.log(`[candidates] novelty elimination: ${unknowns.length} unknowns remaining`);
	}

	while (unknowns.length > 0) {
		if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

		iterCount++;

		// Build novelty constraint: OR of all remaining unknowns
		const oh0 = performance.now();
		const orParts = unknowns.map((c) =>
			typeof c.value === 'boolean'
				? (c.value ? `(${c.varExpr})` : `(not ${c.varExpr})`)
				: `(${c.varExpr} = ${c.value})`
		);
		const noveltyConstraint = `\nconstraint ${orParts.join(' \\/ ')};`;
		const testModel = normalModel + noveltyConstraint;
		noveltyOverheadMs += performance.now() - oh0;

		const bt0 = performance.now();
		const sol = await solveForSolution(testModel, solver, (stats) => accStats('novelty', stats));
		const bt1 = performance.now();
		noveltySolveMs += bt1 - bt0;

		if (sol) {
			const prevCount = unknowns.length;
			const nh0 = performance.now();
			harvest(sol);
			const oh1 = performance.now();
			unknowns = getUnknowns();
			noveltyHarvestMs += oh1 - nh0;
			noveltyOverheadMs += performance.now() - oh1;
			const resolved = prevCount - unknowns.length;
			console.log(
				`[novelty ${iterCount}] SAT in ${bt1 - bt0 | 0}ms, ` +
				`resolved ${resolved} unknowns (${unknowns.length} remaining)`
			);
		} else {
			console.log(
				`[novelty ${iterCount}] UNSAT in ${bt1 - bt0 | 0}ms → ` +
				`all ${unknowns.length} remaining unknowns are false. Done.`
			);
			unknowns = [];
		}

		onProgress?.({ phase: 'eliminating', completed: totalUnknowns - unknowns.length, total: totalUnknowns });
	}

	const t2 = performance.now();
	console.log(
		`[candidates] novelty: ${t2 - t1 | 0}ms, ${iterCount} iterations`
	);
	console.log(`[candidates] total: ${t2 - t0 | 0}ms`);

	// [profile] breakdown summary
	const samplingSolveMs = samplingWallMs - samplingHarvestMs;
	console.table({
		'js.compile': { ms: compileMs | 0 },
		'sampling.solve': { ms: samplingSolveMs | 0 },
		'  └ mzn.flatten': { ms: samplingFlatMs | 0 },
		'  └ mzn.solve': { ms: samplingMznSolveMs | 0 },
		'sampling.harvest': { ms: samplingHarvestMs | 0 },
		'novelty.solve': { ms: noveltySolveMs | 0 },
		'  └ mzn.flatten ': { ms: noveltyFlatMs | 0 },
		'  └ mzn.solve ': { ms: noveltyMznSolveMs | 0 },
		'novelty.harvest': { ms: noveltyHarvestMs | 0 },
		'novelty.overhead': { ms: noveltyOverheadMs | 0 },
		total: { ms: (t2 - t0) | 0 },
	});

	return { ...buildCandidateResult(spaces, possibles), solutionCount: totalSolutionCount };
}

/**
 * Native Chuffed true-candidates path.
 * Compiles the model once, Chuffed handles novelty elimination internally.
 * Solutions stream out and are harvested by the same variable-space logic.
 */
async function findTrueCandidatesNative(
	puzzle: PuzzleState,
	rules: LoadedRule[],
	onProgress?: (progress: CandidateProgress) => void,
	signal?: AbortSignal,
): Promise<CandidateResult> {
	const t0 = performance.now();
	const model = compilePuzzle(puzzle, rules);
	const compileMs = performance.now() - t0;

	const spaces = buildVariableSpaces(puzzle);
	const { possibles, allCandidates } = initUnknowns(spaces);
	const totalUnknowns = allCandidates.length;

	onProgress?.({ phase: 'sampling', completed: 0, total: totalUnknowns });

	let solutionCount = 0;
	const solveT0 = performance.now();

	const result = await solveTrueCandidates(
		model,
		(sol) => {
			solutionCount++;
			harvestSolutionGeneric(spaces, possibles, sol);
			const resolved = totalUnknowns - allCandidates.filter(
				(c) => !possibles.get(c.key)?.has(c.value)
			).length;
			onProgress?.({ phase: 'eliminating', completed: resolved, total: totalUnknowns });
		},
		signal,
	);

	const solveMs = performance.now() - solveT0;
	const totalMs = performance.now() - t0;

	console.log(`[candidates native] ${solutionCount} solutions, completed=${result.completed}`);
	console.table({
		'js.compile': { ms: compileMs | 0 },
		'chuffed.solve': { ms: solveMs | 0 },
		total: { ms: totalMs | 0 },
	});

	return { ...buildCandidateResult(spaces, possibles), solutionCount };
}

