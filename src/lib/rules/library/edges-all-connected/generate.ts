import type { PuzzleState } from '$lib/model/types';

/**
 * Edges-all-connected constraint.
 * All nodes must be connected via edges, forming a single connected component.
 *
 * Uses MiniZinc's `connected.mzn` global constraint.
 * Builds a graph where nodes are border intersections and edges are border segments.
 * All nodes are selected; an edge is selected iff the corresponding border is true.
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
	// Track the MiniZinc expression for each graph edge
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

	const lines: string[] = [
		'include "connected.mzn";',
		'',
		`int: EAC_N = ${N};`,
		`int: EAC_E = ${E};`,
		`set of int: EAC_NODES = 1..EAC_N;`,
		`set of int: EAC_EDGES = 1..EAC_E;`,
		`array[EAC_EDGES] of EAC_NODES: eac_from = [${fromArr.join(', ')}];`,
		`array[EAC_EDGES] of EAC_NODES: eac_to = [${toArr.join(', ')}];`,
		'',
		'% All nodes are selected',
		`array[EAC_NODES] of var bool: eac_ns = [${Array(N).fill('true').join(', ')}];`,
		'',
		'% Edge selection: edge is selected iff the corresponding border is active',
		`array[EAC_EDGES] of var bool: eac_es = [${edgeExprs.join(', ')}];`,
		'',
		'constraint connected(eac_from, eac_to, eac_ns, eac_es);'
	];

	return lines;
}
