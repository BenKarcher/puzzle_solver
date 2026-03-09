import type { PuzzleState, RuleInstance } from '$lib/model/types';

export default function generate(puzzle: PuzzleState, instance?: RuleInstance): string[] {
	if (!instance) return [];
	const { rows, cols } = puzzle.dimensions;
	const constraints: string[] = [];
	for (const cell of instance.groups[0].cells) {
		const r = cell.row + 1; // 1-indexed
		const c = cell.col + 1;
		const parts: string[] = [];
		if (c > 1) parts.push(`line_h[${r},${c - 1}]`);
		if (c < cols) parts.push(`line_h[${r},${c}]`);
		if (r > 1) parts.push(`line_v[${r - 1},${c}]`);
		if (r < rows) parts.push(`line_v[${r},${c}]`);
		constraints.push(`constraint grid[${r},${c}] = ${parts.join(' + ')};`);
	}
	return constraints;
}
