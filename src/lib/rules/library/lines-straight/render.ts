import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group) return;
	for (const cell of group.cells) {
		helpers.cellFill(cell, 'rgba(173, 216, 230, 0.4)');
	}
}
