import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group || group.cells.length === 0) return;

	// Draw cage outline
	helpers.cage(group.cells, '#333333', helpers.cellSize * 0.07);

	// Draw sum in top-left of the top-left-most cell
	if (group.value !== null) {
		// Find the top-left-most cell
		const sorted = [...group.cells].sort((a, b) =>
			a.row !== b.row ? a.row - b.row : a.col - b.col
		);
		const topLeft = sorted[0];
		helpers.text(
			topLeft,
			String(group.value),
			'top-left',
			helpers.cellSize * 0.22,
			'#333333'
		);
	}
}
