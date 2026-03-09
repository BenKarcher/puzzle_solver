import type { PuzzleState, RuleInstance } from '$lib/model/types';

export default function generate(_puzzle: PuzzleState, instance?: RuleInstance): string[] {
	if (!instance) return [];
	const g1 = instance.groups[0];
	const g2 = instance.groups[1];
	if (!g1 || !g2) return [];
	const len = Math.min(g1.cells.length, g2.cells.length);
	const constraints: string[] = [];
	for (let i = 0; i < len; i++) {
		const c1 = g1.cells[i];
		const c2 = g2.cells[i];
		constraints.push(`constraint grid[${c1.row + 1},${c1.col + 1}] = grid[${c2.row + 1},${c2.col + 1}];`);
	}
	return constraints;
}
