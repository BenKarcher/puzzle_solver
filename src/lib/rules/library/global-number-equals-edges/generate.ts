import type { PuzzleState } from '$lib/model/types';

export default function generate(puzzle: PuzzleState): string[] {
	const { rows, cols } = puzzle.dimensions;
	const constraints: string[] = [];
	for (let r = 1; r <= rows; r++) {
		for (let c = 1; c <= cols; c++) {
			// Top: border_h[r, c], Bottom: border_h[r+1, c]
			// Left: border_v[r, c], Right: border_v[r, c+1]
			const parts: string[] = [
				`bool2int(border_h[${r},${c}])`,
				`bool2int(border_h[${r + 1},${c}])`,
				`bool2int(border_v[${r},${c}])`,
				`bool2int(border_v[${r},${c + 1}])`
			];
			constraints.push(`constraint grid[${r},${c}] = ${parts.join(' + ')};`);
		}
	}
	return constraints;
}
