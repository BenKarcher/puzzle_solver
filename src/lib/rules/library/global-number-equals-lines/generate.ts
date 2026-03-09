import type { PuzzleState } from '$lib/model/types';

export default function generate(puzzle: PuzzleState): string[] {
	const { rows, cols } = puzzle.dimensions;
	const constraints: string[] = [];
	for (let r = 1; r <= rows; r++) {
		for (let c = 1; c <= cols; c++) {
			const parts: string[] = [];
			if (c > 1) parts.push(`line_h[${r},${c - 1}]`);
			if (c < cols) parts.push(`line_h[${r},${c}]`);
			if (r > 1) parts.push(`line_v[${r - 1},${c}]`);
			if (r < rows) parts.push(`line_v[${r},${c}]`);
			constraints.push(`constraint grid[${r},${c}] = ${parts.join(' + ')};`);
		}
	}
	return constraints;
}
