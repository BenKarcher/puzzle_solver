import type { PuzzleState } from '$lib/model/types';

const THIN_LINE_WIDTH = 1;
const THICK_LINE_WIDTH = 3;
const GRID_COLOR = '#333333';
const REGION_BORDER_COLOR = '#000000';

export function drawGridLayer(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	const { rows, cols } = puzzle.dimensions;

	// Draw thin cell borders
	ctx.strokeStyle = GRID_COLOR;
	ctx.lineWidth = THIN_LINE_WIDTH;
	ctx.beginPath();
	for (let r = 0; r <= rows; r++) {
		ctx.moveTo(offsetX, offsetY + r * cellSize);
		ctx.lineTo(offsetX + cols * cellSize, offsetY + r * cellSize);
	}
	for (let c = 0; c <= cols; c++) {
		ctx.moveTo(offsetX + c * cellSize, offsetY);
		ctx.lineTo(offsetX + c * cellSize, offsetY + rows * cellSize);
	}
	ctx.stroke();

	// Draw thick region borders
	ctx.strokeStyle = REGION_BORDER_COLOR;
	ctx.lineWidth = THICK_LINE_WIDTH;
	ctx.beginPath();

	// Outer border
	ctx.rect(offsetX, offsetY, cols * cellSize, rows * cellSize);

	// Internal region borders
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const regionId = puzzle.cells[r][c].regionId;

			// Check right neighbor
			if (c < cols - 1 && puzzle.cells[r][c + 1].regionId !== regionId) {
				const x = offsetX + (c + 1) * cellSize;
				ctx.moveTo(x, offsetY + r * cellSize);
				ctx.lineTo(x, offsetY + (r + 1) * cellSize);
			}

			// Check bottom neighbor
			if (r < rows - 1 && puzzle.cells[r + 1][c].regionId !== regionId) {
				const y = offsetY + (r + 1) * cellSize;
				ctx.moveTo(offsetX + c * cellSize, y);
				ctx.lineTo(offsetX + (c + 1) * cellSize, y);
			}
		}
	}

	ctx.stroke();
}
