import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group || group.cells.length < 2) return;

	const color = '#999999';
	const lineWidth = helpers.cellSize * 0.12;
	const circleRadius = helpers.cellSize * 0.3;

	// Draw line between consecutive cells
	for (let i = 0; i < group.cells.length - 1; i++) {
		helpers.line(group.cells[i], group.cells[i + 1], color, lineWidth);
	}

	// Draw hollow circles at endpoints (first and last cell)
	helpers.circle(group.cells[0], color, circleRadius, false);
	helpers.circle(group.cells[group.cells.length - 1], color, circleRadius, false);
}
