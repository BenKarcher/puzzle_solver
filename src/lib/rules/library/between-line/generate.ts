import type { PuzzleState, RuleInstance } from '$lib/model/types';

/**
 * Between Line constraint generator.
 * The first and last cells are endpoints. All cells in between must have
 * values strictly between the endpoint values: min(first,last) < middle < max(first,last).
 */
export default function generate(_puzzle: PuzzleState, instance?: RuleInstance): string[] {
	if (!instance) return [];

	const group = instance.groups[0];
	if (!group || group.cells.length < 3) return [];

	const cells = group.cells;
	const first = cells[0];
	const last = cells[cells.length - 1];
	const firstRef = `grid[${first.row + 1},${first.col + 1}]`;
	const lastRef = `grid[${last.row + 1},${last.col + 1}]`;

	const constraints: string[] = [];

	for (let i = 1; i < cells.length - 1; i++) {
		const mid = cells[i];
		const midRef = `grid[${mid.row + 1},${mid.col + 1}]`;
		constraints.push(
			`constraint min(${firstRef},${lastRef}) < ${midRef} /\\ ${midRef} < max(${firstRef},${lastRef});`
		);
	}

	return constraints;
}
