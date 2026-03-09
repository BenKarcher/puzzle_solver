import type { PuzzleState } from '$lib/model/types';

/**
 * Edges-used-connected constraint.
 * All nodes that have at least one edge must be connected via edges.
 *
 * Uses MiniZinc's `connected.mzn` global constraint.
 * Builds a graph where nodes are border intersections and edges are border segments.
 * A node is selected iff it has degree > 0; an edge is selected iff the border is true.
 */
export default function generate(puzzle: PuzzleState): string[] {
	const { rows, cols } = puzzle.dimensions;
	const nodeRows = rows + 1;
	const nodeCols = cols + 1;
	const N = nodeRows * nodeCols;

	// Node (r, c) -> 1-based index (r in 0..rows, c in 0..cols)
	const nodeIndex = (r: number, c: number) => r * nodeCols + c + 1;

	// Build graph edges from border segments
	const fromArr: number[] = [];
	const toArr: number[] = [];
	const edgeExprs: string[] = [];

	// Horizontal borders: border_h[r, c] connects node (r-1, c-1) to node (r-1, c)
	// border_h is indexed [1..rows+1, 1..cols]
	for (let r = 0; r < nodeRows; r++) {
		for (let c = 0; c < nodeCols - 1; c++) {
			fromArr.push(nodeIndex(r, c));
			toArr.push(nodeIndex(r, c + 1));
			edgeExprs.push(`border_h[${r + 1}, ${c + 1}]`);
		}
	}

	// Vertical borders: border_v[r, c] connects node (r-1, c-1) to node (r, c-1)
	// border_v is indexed [1..rows, 1..cols+1]
	for (let r = 0; r < nodeRows - 1; r++) {
		for (let c = 0; c < nodeCols; c++) {
			fromArr.push(nodeIndex(r, c));
			toArr.push(nodeIndex(r + 1, c));
			edgeExprs.push(`border_v[${r + 1}, ${c + 1}]`);
		}
	}

	const E = fromArr.length;
	if (E === 0) return [];

	// Build node degree expressions
	// For each node, compute degree = sum of adjacent borders
	const nodeExprs: string[] = [];
	for (let r = 0; r < nodeRows; r++) {
		for (let c = 0; c < nodeCols; c++) {
			const mzR = r + 1; // 1-indexed row in node grid
			const mzC = c + 1; // 1-indexed col in node grid
			const terms: string[] = [];
			// Left: border_h[mzR, mzC-1]
			if (mzC > 1) terms.push(`border_h[${mzR}, ${mzC - 1}]`);
			// Right: border_h[mzR, mzC]
			if (mzC <= cols) terms.push(`border_h[${mzR}, ${mzC}]`);
			// Up: border_v[mzR-1, mzC]
			if (mzR > 1) terms.push(`border_v[${mzR - 1}, ${mzC}]`);
			// Down: border_v[mzR, mzC]
			if (mzR <= rows) terms.push(`border_v[${mzR}, ${mzC}]`);

			if (terms.length === 0) {
				nodeExprs.push('false');
			} else {
				nodeExprs.push(`(${terms.join(' \\/ ')})`);
			}
		}
	}

	const lines: string[] = [
		'include "connected.mzn";',
		'',
		`int: EUC_N = ${N};`,
		`int: EUC_E = ${E};`,
		`set of int: EUC_NODES = 1..EUC_N;`,
		`set of int: EUC_EDGES = 1..EUC_E;`,
		`array[EUC_EDGES] of EUC_NODES: euc_from = [${fromArr.join(', ')}];`,
		`array[EUC_EDGES] of EUC_NODES: euc_to = [${toArr.join(', ')}];`,
		'',
		'% Node selection: node is selected iff it has at least one active edge',
		`array[EUC_NODES] of var bool: euc_ns = [${nodeExprs.join(', ')}];`,
		'',
		'% Edge selection: edge is selected iff the corresponding border is active',
		`array[EUC_EDGES] of var bool: euc_es = [${edgeExprs.join(', ')}];`,
		'',
		'constraint connected(euc_from, euc_to, euc_ns, euc_es);'
	];

	return lines;
}
