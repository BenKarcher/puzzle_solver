import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const bulb = instance.groups[0];
	const arrow = instance.groups[1];
	if (!bulb || !arrow || bulb.cells.length === 0 || arrow.cells.length === 0) return;

	const color = '#888888';
	const lineWidth = helpers.cellSize * 0.06;

	// Draw bulb circles (stroke only) for each cell in group 0
	for (const cell of bulb.cells) {
		helpers.circle(cell, color, helpers.cellSize * 0.4, false);
	}

	// Draw connecting line from the last bulb cell to the first arrow cell
	helpers.line(bulb.cells[bulb.cells.length - 1], arrow.cells[0], color, lineWidth);

	// Draw arrow line between consecutive cells in group 1
	for (let i = 0; i < arrow.cells.length - 1; i++) {
		helpers.line(arrow.cells[i], arrow.cells[i + 1], color, lineWidth);
	}

	// Draw arrowhead at the last arrow cell
	if (arrow.cells.length >= 2) {
		const from = helpers.cellCenter(arrow.cells[arrow.cells.length - 2]);
		const to = helpers.cellCenter(arrow.cells[arrow.cells.length - 1]);

		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len === 0) return;

		const ux = dx / len;
		const uy = dy / len;

		const headSize = helpers.cellSize * 0.15;
		const ctx = helpers.ctx;

		ctx.save();
		ctx.fillStyle = color;
		ctx.beginPath();
		// Tip of the arrowhead
		ctx.moveTo(to.x, to.y);
		// Left wing (perpendicular offset)
		ctx.lineTo(to.x - ux * headSize + uy * headSize * 0.5, to.y - uy * headSize - ux * headSize * 0.5);
		// Right wing
		ctx.lineTo(to.x - ux * headSize - uy * headSize * 0.5, to.y - uy * headSize + ux * headSize * 0.5);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
}
