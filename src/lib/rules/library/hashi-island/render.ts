import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group) return;

	for (const cell of group.cells) {
		// Grey filled circle — translucent so grid numbers can show through
		helpers.circle(cell, 'rgba(150, 150, 150, 0.35)', helpers.cellSize * 0.4, true);

		// Large bridge-count clue centred in the circle
		if (group.value !== null) {
			helpers.text(cell, String(group.value), 'center', helpers.cellSize * 0.48, '#444444');
		}
	}
}
