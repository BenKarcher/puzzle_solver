import type { PuzzleState } from '$lib/model/types';
import type { CandidateResult } from './candidates';

/** Decision variable field names in MiniZinc solution objects */
export const DECISION_VARS = ['digits', 'values', 'shaded', 'border_h', 'border_v', 'line_h', 'line_v'] as const;

export interface VariableSpace {
	/** Key prefix for maps, e.g. "grid", "shaded", "border_h" */
	keyPrefix: string;
	/** Field name in MiniZinc solution object */
	solField: string;
	/** Field name on CandidateResult */
	resultField: keyof CandidateResult;
	/** Grid dimensions for this sub-space */
	numRows: number;
	numCols: number;
	/** All possible values for an unknown position */
	domain: (number | boolean)[];
	/** 'numeric' → sorted number[], 'boolean' → true/false/both/null */
	resultKind: 'numeric' | 'boolean';
	/** MiniZinc variable expression for grid position (r, c) */
	mznExpr: (r: number, c: number) => string;
	/** Returns given value if position is given, or undefined if unknown */
	getGiven: (r: number, c: number) => number | boolean | undefined;
	/** Write a solved value to puzzle state at position (r, c) */
	applyValue: (r: number, c: number, value: number | boolean) => void;
	/** Write pencil marks to puzzle state at position (r, c) */
	applyMarks: (r: number, c: number, marks: (number | boolean)[]) => void;
	/** Clear non-given value at position (r, c) */
	clearValue: (r: number, c: number) => void;
}

/** A candidate: a MiniZinc variable expression + value pair */
export interface Candidate {
	varExpr: string;
	value: number | boolean;
	key: string;
}

/** Build the list of VariableSpace descriptors for a puzzle */
export function buildVariableSpaces(puzzle: PuzzleState): VariableSpace[] {
	const { rows, cols } = puzzle.dimensions;
	const spaces: VariableSpace[] = [];

	if (puzzle.solutionSpaces.numbers.enabled) {
		const { min, max } = puzzle.solutionSpaces.numbers;
		const domain: number[] = [];
		for (let v = min; v <= max; v++) domain.push(v);
		spaces.push({
			keyPrefix: 'digits',
			solField: 'digits',
			resultField: 'numbers',
			numRows: rows,
			numCols: cols,
			domain,
			resultKind: 'numeric',
			mznExpr: (r, c) => `digits[${r + 1},${c + 1}]`,
			getGiven: (r, c) => {
				const cell = puzzle.cells[r][c];
				return cell.numberIsGiven && cell.number !== null ? cell.number : undefined;
			},
			applyValue: (r, c, value) => {
				const cell = puzzle.cells[r][c];
				if (!cell.numberIsGiven) cell.number = value as number;
			},
			applyMarks: (r, c, marks) => {
				const cell = puzzle.cells[r][c];
				if (!cell.numberIsGiven) cell.pencilMarks = [...marks] as number[];
			},
			clearValue: (r, c) => {
				const cell = puzzle.cells[r][c];
				if (!cell.numberIsGiven) { cell.number = null; cell.pencilMarks = []; }
			},
		});

		if (puzzle.solutionSpaces.modifiers.enabled) {
			const m = puzzle.solutionSpaces.modifiers;
			const valueDomain: number[] = [];
			for (let v = m.min; v <= m.max; v++) valueDomain.push(v);
			spaces.push({
				keyPrefix: 'values',
				solField: 'values',
				resultField: 'values',
				numRows: rows,
				numCols: cols,
				domain: valueDomain,
				resultKind: 'numeric',
				mznExpr: (r, c) => `values[${r + 1},${c + 1}]`,
				getGiven: () => undefined,
				applyValue: () => {},
				applyMarks: () => {},
				clearValue: () => {},
			});
		}
	}

	if (puzzle.solutionSpaces.shading.enabled) {
		spaces.push({
			keyPrefix: 'shaded',
			solField: 'shaded',
			resultField: 'shading',
			numRows: rows,
			numCols: cols,
			domain: [true, false],
			resultKind: 'boolean',
			mznExpr: (r, c) => `shaded[${r + 1},${c + 1}]`,
			getGiven: (r, c) => {
				const cell = puzzle.cells[r][c];
				return cell.shadedIsGiven && cell.shaded !== null ? cell.shaded : undefined;
			},
			applyValue: (r, c, value) => {
				const cell = puzzle.cells[r][c];
				if (!cell.shadedIsGiven) cell.shaded = value as boolean;
			},
			applyMarks: () => {},
			clearValue: (r, c) => {
				const cell = puzzle.cells[r][c];
				if (!cell.shadedIsGiven) cell.shaded = null;
			},
		});
	}

	if (puzzle.solutionSpaces.borders.enabled) {
		spaces.push({
			keyPrefix: 'border_h',
			solField: 'border_h',
			resultField: 'borderH',
			numRows: rows + 1,
			numCols: cols,
			domain: [true, false],
			resultKind: 'boolean',
			mznExpr: (r, c) => `border_h[${r + 1},${c + 1}]`,
			getGiven: (r, c) => {
				const edge = puzzle.hEdges[r]?.[c];
				return edge?.borderIsGiven && edge.border !== null ? edge.border : undefined;
			},
			applyValue: (r, c, value) => {
				const edge = puzzle.hEdges[r]?.[c];
				if (edge && !edge.borderIsGiven) edge.border = value as boolean;
			},
			applyMarks: () => {},
			clearValue: (r, c) => {
				const edge = puzzle.hEdges[r]?.[c];
				if (edge && !edge.borderIsGiven) edge.border = null;
			},
		});
		spaces.push({
			keyPrefix: 'border_v',
			solField: 'border_v',
			resultField: 'borderV',
			numRows: rows,
			numCols: cols + 1,
			domain: [true, false],
			resultKind: 'boolean',
			mznExpr: (r, c) => `border_v[${r + 1},${c + 1}]`,
			getGiven: (r, c) => {
				const edge = puzzle.vEdges[r]?.[c];
				return edge?.borderIsGiven && edge.border !== null ? edge.border : undefined;
			},
			applyValue: (r, c, value) => {
				const edge = puzzle.vEdges[r]?.[c];
				if (edge && !edge.borderIsGiven) edge.border = value as boolean;
			},
			applyMarks: () => {},
			clearValue: (r, c) => {
				const edge = puzzle.vEdges[r]?.[c];
				if (edge && !edge.borderIsGiven) edge.border = null;
			},
		});
	}

	if (puzzle.solutionSpaces.lines.enabled) {
		const maxL = puzzle.solutionSpaces.lines.maxLinesPerPair;
		const domain: number[] = [];
		for (let v = 0; v <= maxL; v++) domain.push(v);

		// line_h: grid (r, c) → vEdges[r][c+1], MZN line_h[r+1, c+1]
		spaces.push({
			keyPrefix: 'line_h',
			solField: 'line_h',
			resultField: 'lineH',
			numRows: rows,
			numCols: cols - 1,
			domain,
			resultKind: 'numeric',
			mznExpr: (r, c) => `line_h[${r + 1},${c + 1}]`,
			getGiven: (r, c) => {
				const edge = puzzle.vEdges[r]?.[c + 1];
				return edge?.lineIsGiven && edge.lines !== null ? edge.lines : undefined;
			},
			applyValue: (r, c, value) => {
				const edge = puzzle.vEdges[r]?.[c + 1];
				if (edge && !edge.lineIsGiven) edge.lines = value as number;
			},
			applyMarks: (r, c, marks) => {
				const edge = puzzle.vEdges[r]?.[c + 1];
				if (edge && !edge.lineIsGiven) edge.linePencilMarks = [...marks] as number[];
			},
			clearValue: (r, c) => {
				const edge = puzzle.vEdges[r]?.[c + 1];
				if (edge && !edge.lineIsGiven) { edge.lines = null; edge.linePencilMarks = []; }
			},
		});

		// line_v: grid (r, c) → hEdges[r+1][c], MZN line_v[r+1, c+1]
		spaces.push({
			keyPrefix: 'line_v',
			solField: 'line_v',
			resultField: 'lineV',
			numRows: rows - 1,
			numCols: cols,
			domain,
			resultKind: 'numeric',
			mznExpr: (r, c) => `line_v[${r + 1},${c + 1}]`,
			getGiven: (r, c) => {
				const edge = puzzle.hEdges[r + 1]?.[c];
				return edge?.lineIsGiven && edge.lines !== null ? edge.lines : undefined;
			},
			applyValue: (r, c, value) => {
				const edge = puzzle.hEdges[r + 1]?.[c];
				if (edge && !edge.lineIsGiven) edge.lines = value as number;
			},
			applyMarks: (r, c, marks) => {
				const edge = puzzle.hEdges[r + 1]?.[c];
				if (edge && !edge.lineIsGiven) edge.linePencilMarks = [...marks] as number[];
			},
			clearValue: (r, c) => {
				const edge = puzzle.hEdges[r + 1]?.[c];
				if (edge && !edge.lineIsGiven) { edge.lines = null; edge.linePencilMarks = []; }
			},
		});
	}

	return spaces;
}

// --- Utility functions used by candidates.ts ---

/** Initialize unknown tracking maps from variable spaces */
export function initUnknowns(spaces: VariableSpace[]): {
	possibles: Map<string, Set<number | boolean>>;
	allCandidates: Candidate[];
} {
	const possibles = new Map<string, Set<number | boolean>>();
	const allCandidates: Candidate[] = [];

	for (const sp of spaces) {
		for (let r = 0; r < sp.numRows; r++) {
			for (let c = 0; c < sp.numCols; c++) {
				const key = `${sp.keyPrefix}:${r}:${c}`;
				const given = sp.getGiven(r, c);
				if (given !== undefined) {
					possibles.set(key, new Set([given]));
				} else {
					possibles.set(key, new Set());
					for (const v of sp.domain) {
						allCandidates.push({ varExpr: sp.mznExpr(r, c), value: v, key });
					}
				}
			}
		}
	}

	return { possibles, allCandidates };
}

/** Extract values from a MiniZinc solution and add them to the possibles map */
export function harvestSolution(
	spaces: VariableSpace[],
	possibles: Map<string, Set<number | boolean>>,
	sol: Record<string, unknown>,
): void {
	for (const sp of spaces) {
		const data = sol[sp.solField] as (number | boolean)[][] | undefined;
		if (!data) continue;
		for (let r = 0; r < Math.min(sp.numRows, data.length); r++) {
			for (let c = 0; c < Math.min(sp.numCols, data[r]?.length ?? 0); c++) {
				possibles.get(`${sp.keyPrefix}:${r}:${c}`)?.add(data[r][c]);
			}
		}
	}
}

/** Convert the possibles map into CandidateResult format */
export function buildCandidateResult(
	spaces: VariableSpace[],
	possibles: Map<string, Set<number | boolean>>,
): CandidateResult {
	const result: CandidateResult = {};

	for (const sp of spaces) {
		if (sp.resultKind === 'numeric') {
			(result as Record<string, unknown>)[sp.resultField] = Array.from(
				{ length: sp.numRows },
				(_, r) => Array.from({ length: sp.numCols }, (_, c) => {
					const vals = possibles.get(`${sp.keyPrefix}:${r}:${c}`);
					return vals ? ([...vals].sort() as number[]) : [];
				})
			);
		} else {
			(result as Record<string, unknown>)[sp.resultField] = Array.from(
				{ length: sp.numRows },
				(_, r) => Array.from({ length: sp.numCols }, (_, c) => {
					const vals = possibles.get(`${sp.keyPrefix}:${r}:${c}`);
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
	}

	return result;
}

/** Build a deduplication key from only the decision variables of a solution */
export function solutionKey(sol: Record<string, unknown>): string {
	const parts: string[] = [];
	for (const k of DECISION_VARS) {
		if (k in sol) parts.push(JSON.stringify(sol[k]));
	}
	return parts.join('|');
}
