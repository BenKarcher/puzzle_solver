import type { CellVarState, PuzzleState, VarKind } from '$lib/model/types';
import { constantDefault, instanceDomain, mznNamesFor } from '$lib/model/variables';
import type { CandidateResult } from './candidates';

export interface VariableSpace {
	/** Owning variable instance id */
	varId: string;
	kind: VarKind;
	/** MZN array name — also the field name in solution objects and CandidateResult.grids */
	solField: string;
	/** True when the instance is constant (compiled as a fixed par array) */
	isConstant: boolean;
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
	/** Raw user value at position (given or solve entry), or null */
	getValue: (r: number, c: number) => number | boolean | null;
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

interface FacetSpec {
	facet: 'cells' | 'h' | 'v';
	numRows: number;
	numCols: number;
	/** Map descriptor grid (r, c) → storage grid position */
	toStore: (r: number, c: number) => { r: number; c: number };
}

/**
 * Facets per kind. Line kinds use the interior-edge ↔ MZN index mapping:
 *   line_h grid (r, c) → v-storage [r][c+1], MZN line_h[r+1, c+1]
 *   line_v grid (r, c) → h-storage [r+1][c], MZN line_v[r+1, c+1]
 */
function facetsForKind(kind: VarKind, rows: number, cols: number): FacetSpec[] {
	switch (kind) {
		case 'number':
		case 'boolean':
			return [{ facet: 'cells', numRows: rows, numCols: cols, toStore: (r, c) => ({ r, c }) }];
		case 'border':
			return [
				{ facet: 'h', numRows: rows + 1, numCols: cols, toStore: (r, c) => ({ r, c }) },
				{ facet: 'v', numRows: rows, numCols: cols + 1, toStore: (r, c) => ({ r, c }) }
			];
		case 'line':
			return [
				{ facet: 'v', numRows: rows, numCols: cols - 1, toStore: (r, c) => ({ r, c: c + 1 }) },
				{ facet: 'h', numRows: rows - 1, numCols: cols, toStore: (r: number, c: number) => ({ r: r + 1, c }) }
			];
	}
}

/** MZN base name per facet index for each kind (matches variables.ts KIND_BASE order) */
function facetSolField(kind: VarKind, arrays: string[], facet: 'cells' | 'h' | 'v'): string {
	if (kind === 'number' || kind === 'boolean') return arrays[0];
	if (kind === 'border') return facet === 'h' ? arrays[0] : arrays[1];
	// line: arrays = [line_h, line_v]; the v-storage facet is line_h (horizontal connections)
	return facet === 'v' ? arrays[0] : arrays[1];
}

/** Build the list of VariableSpace descriptors for a puzzle (one per instance facet) */
export function buildVariableSpaces(puzzle: PuzzleState): VariableSpace[] {
	const { rows, cols } = puzzle.dimensions;
	const names = mznNamesFor(puzzle);
	const spaces: VariableSpace[] = [];

	for (const v of puzzle.variables) {
		const arrays = names.get(v.id)?.arrays ?? [];
		const domain = instanceDomain(v);
		const resultKind: 'numeric' | 'boolean' =
			v.kind === 'boolean' || v.kind === 'border' ? 'boolean' : 'numeric';
		const isConstant = v.constant === true;
		const cDefault = constantDefault(v);
		const grid = puzzle.varData[v.id];

		for (const spec of facetsForKind(v.kind, rows, cols)) {
			const solField = facetSolField(v.kind, arrays, spec.facet);
			const store = (): CellVarState[][] | undefined => grid?.[spec.facet];
			const at = (r: number, c: number): CellVarState | undefined => {
				const p = spec.toStore(r, c);
				return store()?.[p.r]?.[p.c];
			};

			spaces.push({
				varId: v.id,
				kind: v.kind,
				solField,
				isConstant,
				numRows: spec.numRows,
				numCols: spec.numCols,
				domain,
				resultKind,
				mznExpr: (r, c) => `${solField}[${r + 1},${c + 1}]`,
				getGiven: (r, c) => {
					const s = at(r, c);
					if (s?.isGiven && s.value !== null) return s.value;
					// Constant instances: every position is effectively known
					if (isConstant) return cDefault;
					return undefined;
				},
				getValue: (r, c) => at(r, c)?.value ?? null,
				applyValue: (r, c, value) => {
					const s = at(r, c);
					if (s && !s.isGiven) s.value = value;
				},
				applyMarks: (r, c, marks) => {
					const s = at(r, c);
					if (s && !s.isGiven) s.marks = [...marks] as number[];
				},
				clearValue: (r, c) => {
					const s = at(r, c);
					if (s && !s.isGiven) {
						s.value = null;
						s.marks = [];
					}
				}
			});
		}
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
				const key = `${sp.solField}:${r}:${c}`;
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
				possibles.get(`${sp.solField}:${r}:${c}`)?.add(data[r][c]);
			}
		}
	}
}

/** Convert the possibles map into CandidateResult format */
export function buildCandidateResult(
	spaces: VariableSpace[],
	possibles: Map<string, Set<number | boolean>>,
): CandidateResult {
	const result: CandidateResult = { grids: {} };

	for (const sp of spaces) {
		if (sp.resultKind === 'numeric') {
			result.grids[sp.solField] = Array.from(
				{ length: sp.numRows },
				(_, r) => Array.from({ length: sp.numCols }, (_, c) => {
					const vals = possibles.get(`${sp.solField}:${r}:${c}`);
					return vals ? ([...vals].sort((a, b) => (a as number) - (b as number)) as number[]) : [];
				})
			);
		} else {
			result.grids[sp.solField] = Array.from(
				{ length: sp.numRows },
				(_, r) => Array.from({ length: sp.numCols }, (_, c) => {
					const vals = possibles.get(`${sp.solField}:${r}:${c}`);
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
export function solutionKey(sol: Record<string, unknown>, fields: string[]): string {
	const parts: string[] = [];
	for (const k of fields) {
		if (k in sol) parts.push(JSON.stringify(sol[k]));
	}
	return parts.join('|');
}
