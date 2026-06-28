import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group || group.cells.length === 0) return;

	const size = helpers.cellSize * 0.4;

	for (const cell of group.cells) {
		const center = helpers.cellCenter(cell);
		const deg120 = 2 * Math.PI / 3;
		helpers.ctx.beginPath();
		helpers.ctx.moveTo(center.x, center.y - size);
		helpers.ctx.lineTo(center.x + size * Math.sin(deg120), center.y - size * Math.cos(deg120));
		helpers.ctx.lineTo(center.x - size * Math.sin(deg120), center.y - size * Math.cos(deg120));
		helpers.ctx.closePath();
		helpers.ctx.strokeStyle = 'rgba(120, 120, 120, 0.4)';
		helpers.ctx.lineWidth = 5;
		helpers.ctx.stroke();
	}
}
