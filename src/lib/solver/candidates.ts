import type { PuzzleState, LoadedRule } from '$lib/model/types';
import { compilePuzzle } from './compiler';
import { checkSatisfiable } from './worker';

export interface CandidateResult {
	/** For each cell [row][col], the set of possible values */
	numbers?: number[][][];
	/** For each cell [row][col], true/false/both */
	shading?: ('true' | 'false' | 'both' | null)[][];
}

export interface CandidateProgress {
	completed: number;
	total: number;
}

/**
 * Find true candidates for all variables.
 * For each cell and each possible value, check if that assignment is satisfiable.
 */
export async function findTrueCandidates(
	puzzle: PuzzleState,
	rules: LoadedRule[],
	onProgress?: (progress: CandidateProgress) => void,
	signal?: AbortSignal,
	solver: string = 'gecode'
): Promise<CandidateResult> {
	const baseModel = compilePuzzle(puzzle, rules);
	// Remove the "solve satisfy;" line so we can append constraints
	const baseWithoutSolve = baseModel.replace(/\nsolve satisfy;\s*$/, '\n');

	const result: CandidateResult = {};
	const { rows, cols } = puzzle.dimensions;

	let completed = 0;
	let total = 0;

	// Count total checks needed
	if (puzzle.solutionSpaces.numbers.enabled) {
		const { min, max } = puzzle.solutionSpaces.numbers;
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				if (!puzzle.cells[r][c].numberIsGiven) {
					total += max - min + 1;
				}
			}
		}
	}
	if (puzzle.solutionSpaces.shading.enabled) {
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				if (!puzzle.cells[r][c].shadedIsGiven) {
					total += 2;
				}
			}
		}
	}

	// Number candidates
	if (puzzle.solutionSpaces.numbers.enabled) {
		const { min, max } = puzzle.solutionSpaces.numbers;
		const candidates: number[][][] = Array.from({ length: rows }, () =>
			Array.from({ length: cols }, () => [])
		);

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const cell = puzzle.cells[r][c];
				if (cell.numberIsGiven && cell.number !== null) {
					candidates[r][c] = [cell.number];
					continue;
				}

				for (let v = min; v <= max; v++) {
					if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

					const testModel =
						baseWithoutSolve +
						`constraint grid[${r + 1},${c + 1}] = ${v};\nsolve satisfy;\n`;

					const sat = await checkSatisfiable(testModel, solver);
					if (sat) {
						candidates[r][c].push(v);
					}

					completed++;
					onProgress?.({ completed, total });
				}
			}
		}

		result.numbers = candidates;
	}

	// Shading candidates
	if (puzzle.solutionSpaces.shading.enabled) {
		const shadingCandidates: ('true' | 'false' | 'both' | null)[][] = Array.from(
			{ length: rows },
			() => Array.from({ length: cols }, () => null)
		);

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const cell = puzzle.cells[r][c];
				if (cell.shadedIsGiven) {
					shadingCandidates[r][c] = cell.shaded ? 'true' : 'false';
					continue;
				}

				if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

				const canShade = await checkSatisfiable(
					baseWithoutSolve +
						`constraint shaded[${r + 1},${c + 1}] = true;\nsolve satisfy;\n`,
					solver
				);
				completed++;

				const canUnshade = await checkSatisfiable(
					baseWithoutSolve +
						`constraint shaded[${r + 1},${c + 1}] = false;\nsolve satisfy;\n`,
					solver
				);
				completed++;

				onProgress?.({ completed, total });

				if (canShade && canUnshade) {
					shadingCandidates[r][c] = 'both';
				} else if (canShade) {
					shadingCandidates[r][c] = 'true';
				} else if (canUnshade) {
					shadingCandidates[r][c] = 'false';
				}
			}
		}

		result.shading = shadingCandidates;
	}

	return result;
}
