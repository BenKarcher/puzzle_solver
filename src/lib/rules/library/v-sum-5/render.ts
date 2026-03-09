import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group || group.cells.length !== 2) return;

	helpers.edgeText(
		group.cells[0],
		group.cells[1],
		'V',
		helpers.cellSize * 0.3,
		'#333333'
	);
}
