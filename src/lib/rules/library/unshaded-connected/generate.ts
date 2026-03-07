import type { PuzzleState } from '$lib/model/types';

/**
 * Unshaded-connected constraint.
 * All unshaded cells must form a single orthogonally connected group.
 *
 * Uses MiniZinc's `connected.mzn` global constraint.
 * Builds a grid graph where nodes are cells and edges are orthogonal adjacencies.
 * Node selection = NOT shaded array, edge selection = both endpoints unshaded.
 */
export default function generate(puzzle: PuzzleState): string[] {
	const { rows, cols } = puzzle.dimensions;
	const N = rows * cols;

	// Cell (r,c) -> node index (1-based for MiniZinc)
	const nodeIndex = (r: number, c: number) => r * cols + c + 1;

	// Enumerate all orthogonal adjacency edges
	const fromArr: number[] = [];
	const toArr: number[] = [];

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			// Right neighbor
			if (c + 1 < cols) {
				fromArr.push(nodeIndex(r, c));
				toArr.push(nodeIndex(r, c + 1));
			}
			// Down neighbor
			if (r + 1 < rows) {
				fromArr.push(nodeIndex(r, c));
				toArr.push(nodeIndex(r + 1, c));
			}
		}
	}

	const E = fromArr.length;
	if (E === 0) return [];

	const lines: string[] = [
		'include "connected.mzn";',
		'',
		`int: UC_N = ${N};`,
		`int: UC_E = ${E};`,
		`set of int: UC_NODES = 1..UC_N;`,
		`set of int: UC_EDGES = 1..UC_E;`,
		`array[UC_EDGES] of UC_NODES: uc_from = [${fromArr.join(', ')}];`,
		`array[UC_EDGES] of UC_NODES: uc_to = [${toArr.join(', ')}];`,
		'',
		'% Node selection: map 2D shaded array to 1D (negated for unshaded)',
		`array[UC_NODES] of var bool: uc_ns = [${
			Array.from({ length: N }, (_, i) => {
				const r = Math.floor(i / cols) + 1;
				const c = (i % cols) + 1;
				return `not shaded[${r},${c}]`;
			}).join(', ')
		}];`,
		'',
		'% Edge selection: edge is selected iff both endpoints are unshaded',
		'array[UC_EDGES] of var bool: uc_es;',
		'constraint forall(e in UC_EDGES)(uc_es[e] <-> (not shaded[uc_from[e]] /\\ not shaded[uc_to[e]]));',
		'',
		'constraint connected(uc_from, uc_to, uc_ns, uc_es);'
	];

	return lines;
}
