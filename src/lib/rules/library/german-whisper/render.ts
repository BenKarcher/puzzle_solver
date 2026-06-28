import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group || group.cells.length < 2) return;

	const color = '#25f92c';
	const width = helpers.cellSize * 0.15;

	for (let i = 0; i < group.cells.length - 1; i++) {
		helpers.line(group.cells[i], group.cells[i + 1], color, width);
	}
}
