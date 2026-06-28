import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group) return;

	const s = group.cells[0];
	const g = group.cells[1];
	const fontSize = helpers.cellSize * 0.52;

	if (s) {
		// helpers.cellFill(s, 'rgba(100, 180, 255, 0.3)');
		helpers.text(s, 'S', 'center', fontSize, 'rgba(120, 120, 120, 0.4)');
	}
	if (g) {
		// helpers.cellFill(g, 'rgba(255, 150, 80, 0.3)');
		helpers.text(g, 'G', 'center', fontSize, 'rgba(120, 120, 120, 0.4)');
	}
}
