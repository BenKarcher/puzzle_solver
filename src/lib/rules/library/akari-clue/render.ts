import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group || group.value === null) return;

	const fontSize = helpers.cellSize * 0.5;
	for (const cell of group.cells) {
		const { x, y } = helpers.cellCenter(cell);
		const label = String(group.value);
		// White number with dark outline — readable on both wall and empty cells
		helpers.ctx.font = `bold ${fontSize}px sans-serif`;
		helpers.ctx.textAlign = 'center';
		helpers.ctx.textBaseline = 'middle';
		helpers.ctx.lineWidth = Math.max(2, fontSize * 0.14);
		helpers.ctx.strokeStyle = '#222222';
		helpers.ctx.strokeText(label, x, y);
		helpers.ctx.fillStyle = '#ffffff';
		helpers.ctx.fillText(label, x, y);
	}
}
