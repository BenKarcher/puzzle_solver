import type { PuzzleState, LoadedRule } from '$lib/model/types';
import { compilePuzzle, type ValueChoice } from './compiler';
import { solveAllTimed, solveForSolution } from './worker';

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

/** A candidate: a MiniZinc variable expression + value pair */
interface Candidate {
	varExpr: string; // e.g. "grid[2,3]"
	value: number | boolean;
	key: string; // e.g. "grid:1:2" (0-indexed coords)
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
	const { rows, cols } = puzzle.dimensions;

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

	// Build the set of all unknown candidates and their possible values
	const possibles = new Map<string, Set<number | boolean>>();
	const allValues = new Map<string, Set<number | boolean>>();
	const allCandidates: Candidate[] = [];

	// Initialize unknown sets for each variable
	if (puzzle.solutionSpaces.numbers.enabled) {
		const { min, max } = puzzle.solutionSpaces.numbers;
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const cell = puzzle.cells[r][c];
				const key = `grid:${r}:${c}`;
				if (cell.numberIsGiven && cell.number !== null) {
					possibles.set(key, new Set([cell.number]));
					allValues.set(key, new Set([cell.number]));
				} else {
					possibles.set(key, new Set());
					const vals = new Set<number | boolean>();
					for (let v = min; v <= max; v++) {
						vals.add(v);
						allCandidates.push({ varExpr: `grid[${r + 1},${c + 1}]`, value: v, key });
					}
					allValues.set(key, vals);
				}
			}
		}
	}

	if (puzzle.solutionSpaces.shading.enabled) {
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const cell = puzzle.cells[r][c];
				const key = `shaded:${r}:${c}`;
				if (cell.shadedIsGiven && cell.shaded !== null) {
					possibles.set(key, new Set([cell.shaded]));
					allValues.set(key, new Set([cell.shaded]));
				} else {
					possibles.set(key, new Set());
					allValues.set(key, new Set([true, false]));
					allCandidates.push({ varExpr: `shaded[${r + 1},${c + 1}]`, value: true, key });
					allCandidates.push({ varExpr: `shaded[${r + 1},${c + 1}]`, value: false, key });
				}
			}
		}
	}

	if (puzzle.solutionSpaces.borders.enabled) {
		for (let r = 0; r <= rows; r++) {
			for (let c = 0; c < cols; c++) {
				const edge = puzzle.hEdges[r]?.[c];
				const key = `border_h:${r}:${c}`;
				if (edge?.borderIsGiven && edge.border !== null) {
					possibles.set(key, new Set([edge.border]));
					allValues.set(key, new Set([edge.border]));
				} else {
					possibles.set(key, new Set());
					allValues.set(key, new Set([true, false]));
					allCandidates.push({ varExpr: `border_h[${r + 1},${c + 1}]`, value: true, key });
					allCandidates.push({ varExpr: `border_h[${r + 1},${c + 1}]`, value: false, key });
				}
			}
		}
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c <= cols; c++) {
				const edge = puzzle.vEdges[r]?.[c];
				const key = `border_v:${r}:${c}`;
				if (edge?.borderIsGiven && edge.border !== null) {
					possibles.set(key, new Set([edge.border]));
					allValues.set(key, new Set([edge.border]));
				} else {
					possibles.set(key, new Set());
					allValues.set(key, new Set([true, false]));
					allCandidates.push({ varExpr: `border_v[${r + 1},${c + 1}]`, value: true, key });
					allCandidates.push({ varExpr: `border_v[${r + 1},${c + 1}]`, value: false, key });
				}
			}
		}
	}

	if (puzzle.solutionSpaces.lines.enabled) {
		const maxL = puzzle.solutionSpaces.lines.maxLinesPerPair;
		// line_h: vEdges[r][c] c=1..cols-1 → line_h[r+1, c]
		for (let r = 0; r < rows; r++) {
			for (let c = 1; c < cols; c++) {
				const edge = puzzle.vEdges[r]?.[c];
				const key = `line_h:${r}:${c - 1}`;
				if (edge?.lineIsGiven && edge.lines !== null) {
					possibles.set(key, new Set([edge.lines]));
					allValues.set(key, new Set([edge.lines]));
				} else {
					possibles.set(key, new Set());
					const vals = new Set<number | boolean>();
					for (let v = 0; v <= maxL; v++) {
						vals.add(v);
						allCandidates.push({ varExpr: `line_h[${r + 1},${c}]`, value: v, key });
					}
					allValues.set(key, vals);
				}
			}
		}
		// line_v: hEdges[r][c] r=1..rows-1 → line_v[r, c+1]
		for (let r = 1; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const edge = puzzle.hEdges[r]?.[c];
				const key = `line_v:${r - 1}:${c}`;
				if (edge?.lineIsGiven && edge.lines !== null) {
					possibles.set(key, new Set([edge.lines]));
					allValues.set(key, new Set([edge.lines]));
				} else {
					possibles.set(key, new Set());
					const vals = new Set<number | boolean>();
					for (let v = 0; v <= maxL; v++) {
						vals.add(v);
						allCandidates.push({ varExpr: `line_v[${r},${c + 1}]`, value: v, key });
					}
					allValues.set(key, vals);
				}
			}
		}
	}

	const totalUnknowns = allCandidates.length;

	// --- Step 1: Time-bounded solveAll with random search ---
	onProgress?.({ phase: 'sampling', completed: 0, total: totalUnknowns });

	function harvestSolution(sol: Record<string, unknown>): void {
		if (puzzle.solutionSpaces.numbers.enabled && sol.grid) {
			const grid = sol.grid as number[][];
			for (let r = 0; r < Math.min(rows, grid.length); r++) {
				for (let c = 0; c < Math.min(cols, grid[r]?.length ?? 0); c++) {
					possibles.get(`grid:${r}:${c}`)?.add(grid[r][c]);
				}
			}
		}
		if (puzzle.solutionSpaces.shading.enabled && sol.shaded) {
			const shaded = sol.shaded as boolean[][];
			for (let r = 0; r < Math.min(rows, shaded.length); r++) {
				for (let c = 0; c < Math.min(cols, shaded[r]?.length ?? 0); c++) {
					possibles.get(`shaded:${r}:${c}`)?.add(shaded[r][c]);
				}
			}
		}
		if (puzzle.solutionSpaces.borders.enabled) {
			if (sol.border_h) {
				const bh = sol.border_h as boolean[][];
				for (let r = 0; r < Math.min(rows + 1, bh.length); r++) {
					for (let c = 0; c < Math.min(cols, bh[r]?.length ?? 0); c++) {
						possibles.get(`border_h:${r}:${c}`)?.add(bh[r][c]);
					}
				}
			}
			if (sol.border_v) {
				const bv = sol.border_v as boolean[][];
				for (let r = 0; r < Math.min(rows, bv.length); r++) {
					for (let c = 0; c < Math.min(cols + 1, bv[r]?.length ?? 0); c++) {
						possibles.get(`border_v:${r}:${c}`)?.add(bv[r][c]);
					}
				}
			}
		}
		if (puzzle.solutionSpaces.lines.enabled) {
			if (sol.line_h) {
				const lh = sol.line_h as number[][];
				for (let r = 0; r < Math.min(rows, lh.length); r++) {
					for (let c = 0; c < Math.min(cols - 1, lh[r]?.length ?? 0); c++) {
						possibles.get(`line_h:${r}:${c}`)?.add(lh[r][c]);
					}
				}
			}
			if (sol.line_v) {
				const lv = sol.line_v as number[][];
				for (let r = 0; r < Math.min(rows - 1, lv.length); r++) {
					for (let c = 0; c < Math.min(cols, lv[r]?.length ?? 0); c++) {
						possibles.get(`line_v:${r}:${c}`)?.add(lv[r][c]);
					}
				}
			}
		}
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
			(sol) => { passCount++; totalSolutionCount++; harvestSolution(sol); },
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
		return buildResult(puzzle, possibles, allValues);
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
			harvestSolution(sol);
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

	return buildResult(puzzle, possibles, allValues);
}

/**
 * Convert the possibles map into the CandidateResult format.
 */
function buildResult(
	puzzle: PuzzleState,
	possibles: Map<string, Set<number | boolean>>,
	allValues: Map<string, Set<number | boolean>>
): CandidateResult {
	const result: CandidateResult = {};
	const { rows, cols } = puzzle.dimensions;

	if (puzzle.solutionSpaces.numbers.enabled) {
		result.numbers = Array.from({ length: rows }, (_, r) =>
			Array.from({ length: cols }, (_, c) => {
				const vals = possibles.get(`grid:${r}:${c}`);
				return vals ? ([...vals].sort() as number[]) : [];
			})
		);
	}

	if (puzzle.solutionSpaces.shading.enabled) {
		result.shading = Array.from({ length: rows }, (_, r) =>
			Array.from({ length: cols }, (_, c) => {
				const vals = possibles.get(`shaded:${r}:${c}`);
				if (!vals) return null;
				const hasTrue = vals.has(true);
				const hasFalse = vals.has(false);
				if (hasTrue && hasFalse) return 'both' as const;
				if (hasTrue) return 'true' as const;
				if (hasFalse) return 'false' as const;
				return null;
			})
		);
	}

	if (puzzle.solutionSpaces.borders.enabled) {
		result.borderH = Array.from({ length: rows + 1 }, (_, r) =>
			Array.from({ length: cols }, (_, c) => {
				const vals = possibles.get(`border_h:${r}:${c}`);
				if (!vals) return null;
				const hasTrue = vals.has(true);
				const hasFalse = vals.has(false);
				if (hasTrue && hasFalse) return 'both' as const;
				if (hasTrue) return 'true' as const;
				if (hasFalse) return 'false' as const;
				return null;
			})
		);
		result.borderV = Array.from({ length: rows }, (_, r) =>
			Array.from({ length: cols + 1 }, (_, c) => {
				const vals = possibles.get(`border_v:${r}:${c}`);
				if (!vals) return null;
				const hasTrue = vals.has(true);
				const hasFalse = vals.has(false);
				if (hasTrue && hasFalse) return 'both' as const;
				if (hasTrue) return 'true' as const;
				if (hasFalse) return 'false' as const;
				return null;
			})
		);
	}

	if (puzzle.solutionSpaces.lines.enabled) {
		result.lineH = Array.from({ length: rows }, (_, r) =>
			Array.from({ length: cols - 1 }, (_, c) => {
				const vals = possibles.get(`line_h:${r}:${c}`);
				return vals ? ([...vals].sort() as number[]) : [];
			})
		);
		result.lineV = Array.from({ length: rows - 1 }, (_, r) =>
			Array.from({ length: cols }, (_, c) => {
				const vals = possibles.get(`line_v:${r}:${c}`);
				return vals ? ([...vals].sort() as number[]) : [];
			})
		);
	}

	return result;
}
