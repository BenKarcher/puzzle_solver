import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group || group.cells.length === 0) return;

	for (const cell of group.cells) {
		helpers.circle(cell, '#666666', helpers.cellSize * 0.4, false);
	}
}
