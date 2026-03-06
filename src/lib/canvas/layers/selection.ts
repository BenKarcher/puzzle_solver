import type { CellCoord } from '$lib/model/types';

const SELECTION_COLOR = 'rgba(66, 135, 245, 0.25)';
const SELECTION_BORDER_COLOR = 'rgba(66, 135, 245, 0.7)';

export function drawSelectionLayer(
	ctx: CanvasRenderingContext2D,
	selectedCells: CellCoord[],
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	if (selectedCells.length === 0) return;

	for (const coord of selectedCells) {
		const x = offsetX + coord.col * cellSize;
		const y = offsetY + coord.row * cellSize;

		ctx.fillStyle = SELECTION_COLOR;
		ctx.fillRect(x, y, cellSize, cellSize);

		ctx.strokeStyle = SELECTION_BORDER_COLOR;
		ctx.lineWidth = 2;
		ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
	}
}
