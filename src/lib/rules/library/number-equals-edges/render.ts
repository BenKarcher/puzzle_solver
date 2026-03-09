import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group || group.cells.length === 0) return;

	const inset = helpers.cellSize * 0.12;
	const size = helpers.cellSize - inset * 2;

	for (const cell of group.cells) {
		const topLeft = helpers.cellTopLeft(cell);
		const x = topLeft.x + inset;
		const y = topLeft.y + inset;

		helpers.ctx.strokeStyle = '#666666';
		helpers.ctx.lineWidth = 2;
		helpers.ctx.strokeRect(x, y, size, size);
	}
}
