import type { PuzzleState } from '$lib/model/types';

const BORDER_COLOR = '#000000';
const NO_BORDER_COLOR = '#cc0000';
const BORDER_WIDTH = 3;

export function drawBordersLayer(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	if (!puzzle.solutionSpaces.borders.enabled) return;

	const { rows, cols } = puzzle.dimensions;

	// Horizontal edges (between rows)
	for (let r = 0; r < rows - 1; r++) {
		for (let c = 0; c < cols; c++) {
			const edge = puzzle.hEdges[r]?.[c];
			if (!edge) continue;

			const x1 = offsetX + c * cellSize;
			const x2 = offsetX + (c + 1) * cellSize;
			const y = offsetY + (r + 1) * cellSize;

			if (edge.border === true) {
				ctx.strokeStyle = BORDER_COLOR;
				ctx.lineWidth = BORDER_WIDTH;
				ctx.beginPath();
				ctx.moveTo(x1, y);
				ctx.lineTo(x2, y);
				ctx.stroke();
			} else if (edge.border === false) {
				// Draw small X to indicate no border
				const midX = (x1 + x2) / 2;
				drawSmallX(ctx, midX, y, cellSize * 0.08, NO_BORDER_COLOR);
			}
		}
	}

	// Vertical edges (between columns)
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols - 1; c++) {
			const edge = puzzle.vEdges[r]?.[c];
			if (!edge) continue;

			const x = offsetX + (c + 1) * cellSize;
			const y1 = offsetY + r * cellSize;
			const y2 = offsetY + (r + 1) * cellSize;

			if (edge.border === true) {
				ctx.strokeStyle = BORDER_COLOR;
				ctx.lineWidth = BORDER_WIDTH;
				ctx.beginPath();
				ctx.moveTo(x, y1);
				ctx.lineTo(x, y2);
				ctx.stroke();
			} else if (edge.border === false) {
				const midY = (y1 + y2) / 2;
				drawSmallX(ctx, x, midY, cellSize * 0.08, NO_BORDER_COLOR);
			}
		}
	}
}

function drawSmallX(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	size: number,
	color: string
): void {
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(cx - size, cy - size);
	ctx.lineTo(cx + size, cy + size);
	ctx.moveTo(cx + size, cy - size);
	ctx.lineTo(cx - size, cy + size);
	ctx.stroke();
}
