import type { PuzzleState } from '$lib/model/types';

/**
 * Lines-all-connected constraint.
 * All cells must be connected via lines (a cell is connected to its neighbor
 * if the line between them has value >= 1).
 *
 * Uses MiniZinc's `connected.mzn` global constraint.
 * Nodes = cells, graph edges = orthogonal adjacencies.
 * All nodes selected; edge selected iff line > 0.
 */
export default function generate(puzzle: PuzzleState): string[] {
	const { rows, cols } = puzzle.dimensions;
	const N = rows * cols;

	const nodeIndex = (r: number, c: number) => r * cols + c + 1;

	const fromArr: number[] = [];
	const toArr: number[] = [];
	const edgeExprs: string[] = [];

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			// Right neighbor — line_h[r+1, c+1] (1-indexed)
			if (c + 1 < cols) {
				fromArr.push(nodeIndex(r, c));
				toArr.push(nodeIndex(r, c + 1));
				edgeExprs.push(`(line_h[${r + 1}, ${c + 1}] > 0)`);
			}
			// Down neighbor — line_v[r+1, c+1] (1-indexed)
			if (r + 1 < rows) {
				fromArr.push(nodeIndex(r, c));
				toArr.push(nodeIndex(r + 1, c));
				edgeExprs.push(`(line_v[${r + 1}, ${c + 1}] > 0)`);
			}
		}
	}

	const E = fromArr.length;
	if (E === 0) return [];

	return [
		'include "connected.mzn";',
		'',
		`int: LAC_N = ${N};`,
		`int: LAC_E = ${E};`,
		`set of int: LAC_NODES = 1..LAC_N;`,
		`set of int: LAC_EDGES = 1..LAC_E;`,
		`array[LAC_EDGES] of LAC_NODES: lac_from = [${fromArr.join(', ')}];`,
		`array[LAC_EDGES] of LAC_NODES: lac_to = [${toArr.join(', ')}];`,
		'',
		'% All cells must be connected',
		`array[LAC_NODES] of var bool: lac_ns = [${Array(N).fill('true').join(', ')}];`,
		'',
		'% Edge selected iff line value > 0',
		`array[LAC_EDGES] of var bool: lac_es = [${edgeExprs.join(', ')}];`,
		'',
		'constraint connected(lac_from, lac_to, lac_ns, lac_es);'
	];
}
