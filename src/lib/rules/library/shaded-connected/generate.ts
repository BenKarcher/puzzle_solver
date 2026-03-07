import type { PuzzleState } from '$lib/model/types';

/**
 * Shaded-connected constraint.
 * All shaded cells must form a single orthogonally connected group.
 *
 * Uses MiniZinc's `connected.mzn` global constraint.
 * Builds a grid graph where nodes are cells and edges are orthogonal adjacencies.
 * Node selection = shaded array, edge selection = both endpoints shaded.
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
		`int: SC_N = ${N};`,
		`int: SC_E = ${E};`,
		`set of int: SC_NODES = 1..SC_N;`,
		`set of int: SC_EDGES = 1..SC_E;`,
		`array[SC_EDGES] of SC_NODES: sc_from = [${fromArr.join(', ')}];`,
		`array[SC_EDGES] of SC_NODES: sc_to = [${toArr.join(', ')}];`,
		'',
		'% Node selection: map 2D shaded array to 1D',
		`array[SC_NODES] of var bool: sc_ns = [${
			Array.from({ length: N }, (_, i) => {
				const r = Math.floor(i / cols) + 1;
				const c = (i % cols) + 1;
				return `shaded[${r},${c}]`;
			}).join(', ')
		}];`,
		'',
		'% Edge selection: edge is selected iff both endpoints are shaded',
		'array[SC_EDGES] of var bool: sc_es;',
		'constraint forall(e in SC_EDGES)(sc_es[e] <-> (sc_ns[sc_from[e]] /\\ sc_ns[sc_to[e]]));',
		'',
		'constraint connected(sc_from, sc_to, sc_ns, sc_es);'
	];

	return lines;
}
