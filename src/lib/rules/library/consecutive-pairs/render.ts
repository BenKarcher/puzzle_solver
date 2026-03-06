import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
	instance: RuleInstance,
	helpers: RenderHelpers,
	_puzzle: PuzzleState
): void {
	const group = instance.groups[0];
	if (!group || group.cells.length !== 2) return;

	// Draw a white dot between the two cells
	helpers.dot(
		[group.cells[0], group.cells[1]],
		'#ffffff',
		helpers.cellSize * 0.1
	);

	// Draw dot outline
	const c1 = helpers.cellCenter(group.cells[0]);
	const c2 = helpers.cellCenter(group.cells[1]);
	const mx = (c1.x + c2.x) / 2;
	const my = (c1.y + c2.y) / 2;
	helpers.ctx.strokeStyle = '#333333';
	helpers.ctx.lineWidth = 1.5;
	helpers.ctx.beginPath();
	helpers.ctx.arc(mx, my, helpers.cellSize * 0.1, 0, Math.PI * 2);
	helpers.ctx.stroke();
}
