import type { PuzzleState, RuleInstance } from '$lib/model/types';

export default function generate(puzzle: PuzzleState, instance?: RuleInstance): string[] {
	if (!instance) return [];
	const { rows, cols } = puzzle.dimensions;
	const constraints: string[] = [];
	for (const cell of instance.groups[0].cells) {
		const r = cell.row + 1; // 1-indexed
		const c = cell.col + 1;
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
	return constraints;
}
