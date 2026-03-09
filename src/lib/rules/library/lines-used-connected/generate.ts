import type { PuzzleState } from '$lib/model/types';

/**
 * Lines-used-connected constraint.
 * All cells that have at least one line coming out of them must form a single
 * connected group via lines.
 *
 * Uses MiniZinc's `connected.mzn` global constraint.
 * Nodes = cells, graph edges = orthogonal adjacencies.
 * Node selected iff cell has degree > 0; edge selected iff line > 0.
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

	// Build node selection: cell has degree > 0
	const nodeExprs: string[] = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const mR = r + 1;
			const mC = c + 1;
			const terms: string[] = [];
			if (c > 0) terms.push(`line_h[${mR}, ${mC - 1}] > 0`);
			if (c < cols - 1) terms.push(`line_h[${mR}, ${mC}] > 0`);
			if (r > 0) terms.push(`line_v[${mR - 1}, ${mC}] > 0`);
			if (r < rows - 1) terms.push(`line_v[${mR}, ${mC}] > 0`);
			nodeExprs.push(terms.length > 0 ? `(${terms.join(' \\/ ')})` : 'false');
		}
	}

	return [
		'include "connected.mzn";',
		'',
		`int: LUC_N = ${N};`,
		`int: LUC_E = ${E};`,
		`set of int: LUC_NODES = 1..LUC_N;`,
		`set of int: LUC_EDGES = 1..LUC_E;`,
		`array[LUC_EDGES] of LUC_NODES: luc_from = [${fromArr.join(', ')}];`,
		`array[LUC_EDGES] of LUC_NODES: luc_to = [${toArr.join(', ')}];`,
		'',
		'% Node selected iff cell has at least one line',
		`array[LUC_NODES] of var bool: luc_ns = [${nodeExprs.join(', ')}];`,
		'',
		'% Edge selected iff line value > 0',
		`array[LUC_EDGES] of var bool: luc_es = [${edgeExprs.join(', ')}];`,
		'',
		'constraint connected(luc_from, luc_to, luc_ns, luc_es);'
	];
}
