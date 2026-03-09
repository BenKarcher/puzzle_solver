import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	for (const group of instance.groups) {
		for (const cell of group.cells) {
			helpers.cellFill(cell, 'rgba(147, 197, 253, 0.3)');
		}
	}
}
