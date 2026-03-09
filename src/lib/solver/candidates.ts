import type { PuzzleState, LoadedRule } from '$lib/model/types';
import { compilePuzzle } from './compiler';
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

/**
 * Find true candidates using optimized algorithm:
 * 1. Time-bounded solveAll with random search to sample solutions
 * 2. If complete, return union directly
 * 3. Otherwise, batch-eliminate remaining unknowns with OR clauses
 */
export async function findTrueCandidates(
	puzzle: PuzzleState,
	rules: LoadedRule[],
	onProgress?: (progress: CandidateProgress) => void,
	signal?: AbortSignal,
	solver: string = 'gecode',
	timeLimitMs: number = 5000
): Promise<CandidateResult> {
	const { rows, cols } = puzzle.dimensions;

	// Build the base model with random search for sampling phase
	const randomModel = compilePuzzle(puzzle, rules, { randomSearch: true });
	// Base model without solve line for batch checks
	const normalModel = compilePuzzle(puzzle, rules);
	const baseWithoutSolve = normalModel.replace(/\nsolve satisfy;\s*$/, '\n');

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

	const { completed: allSolutionsFound } = await solveAllTimed(
		randomModel,
		timeLimitMs,
		harvestSolution,
		solver,
		signal
	);

	if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

	// --- Step 2: If all solutions found, we're done ---
	if (allSolutionsFound) {
		return buildResult(puzzle, possibles, allValues);
	}

	// --- Step 3: Batch elimination of remaining unknowns ---
	const BATCH_SIZE = 8;

	// Build list of still-unknown candidates
	function getUnknowns(): Candidate[] {
		return allCandidates.filter(
			(c) => !possibles.get(c.key)?.has(c.value)
		);
	}

	let unknowns = getUnknowns();
	const resolvedCount = totalUnknowns - unknowns.length;
	onProgress?.({ phase: 'eliminating', completed: resolvedCount, total: totalUnknowns });

	while (unknowns.length > 0) {
		if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

		// Pick a batch
		const batch = unknowns.slice(0, BATCH_SIZE);

		// Build OR constraint
		const orParts = batch.map((c) => `(${c.varExpr} = ${c.value})`);
		const orConstraint = `constraint ${orParts.join(' \\/ ')};`;
		const testModel = baseWithoutSolve + orConstraint + '\nsolve satisfy;\n';

		const sol = await solveForSolution(testModel, solver);

		if (sol) {
			// SAT: harvest full solution — marks many candidates as possible
			harvestSolution(sol);
		} else {
			// UNSAT: all candidates in this batch are impossible — nothing to do,
			// they'll be filtered out of unknowns on next getUnknowns() call
		}

		unknowns = getUnknowns();
		const newResolved = totalUnknowns - unknowns.length;
		onProgress?.({ phase: 'eliminating', completed: newResolved, total: totalUnknowns });
	}

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
