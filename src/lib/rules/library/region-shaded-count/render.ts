import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group || group.value === null) return;

	// Find the top-left-most cell in the group to anchor the label
	if (group.cells.length === 0) return;
	const sorted = [...group.cells].sort((a, b) =>
		a.row !== b.row ? a.row - b.row : a.col - b.col
	);
	const topLeft = sorted[0];

	// Render a plain number — slightly larger than a killer cage clue, no cage outline
	helpers.text(
		topLeft,
		String(group.value),
		'top-left',
		helpers.cellSize * 0.3,
		'#333333'
	);
}
