import type { PuzzleState, RuleInstance } from '$lib/model/types';

/**
 * German Whisper Line constraint generator.
 * Consecutive cells on the line must differ by at least 5.
 */
export default function generate(_puzzle: PuzzleState, instance?: RuleInstance): string[] {
	if (!instance) return [];

	const group = instance.groups[0];
	if (!group || group.cells.length < 2) return [];

	const cells = group.cells;
	const constraints: string[] = [];

	for (let i = 0; i < cells.length - 1; i++) {
		const a = cells[i];
		const b = cells[i + 1];
		constraints.push(
			`constraint abs(grid[${a.row + 1},${a.col + 1}] - grid[${b.row + 1},${b.col + 1}]) >= 5;`
		);
	}

	return constraints;
}
