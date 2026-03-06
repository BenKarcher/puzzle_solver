import type { PuzzleState } from '$lib/model/types';

const LINE_COLOR = '#000000';
const LINE_WIDTH = 3;

export function drawLinesLayer(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	if (!puzzle.solutionSpaces.lines.enabled) return;

	const { rows, cols } = puzzle.dimensions;

	ctx.strokeStyle = LINE_COLOR;
	ctx.lineCap = 'round';

	// Horizontal lines (between adjacent columns in same row)
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols - 1; c++) {
			const edge = puzzle.vEdges[r]?.[c];
			if (!edge || edge.lines === 0) continue;

			const x1 = offsetX + c * cellSize + cellSize / 2;
			const x2 = offsetX + (c + 1) * cellSize + cellSize / 2;
			const y = offsetY + r * cellSize + cellSize / 2;

			if (edge.lines === 1) {
				ctx.lineWidth = LINE_WIDTH;
				ctx.beginPath();
				ctx.moveTo(x1, y);
				ctx.lineTo(x2, y);
				ctx.stroke();
			} else if (edge.lines >= 2) {
				const gap = cellSize * 0.06;
				ctx.lineWidth = LINE_WIDTH * 0.7;
				ctx.beginPath();
				ctx.moveTo(x1, y - gap);
				ctx.lineTo(x2, y - gap);
				ctx.moveTo(x1, y + gap);
				ctx.lineTo(x2, y + gap);
				ctx.stroke();
			}
		}
	}

	// Vertical lines (between adjacent rows in same column)
	for (let r = 0; r < rows - 1; r++) {
		for (let c = 0; c < cols; c++) {
			const edge = puzzle.hEdges[r]?.[c];
			if (!edge || edge.lines === 0) continue;

			const x = offsetX + c * cellSize + cellSize / 2;
			const y1 = offsetY + r * cellSize + cellSize / 2;
			const y2 = offsetY + (r + 1) * cellSize + cellSize / 2;

			if (edge.lines === 1) {
				ctx.lineWidth = LINE_WIDTH;
				ctx.beginPath();
				ctx.moveTo(x, y1);
				ctx.lineTo(x, y2);
				ctx.stroke();
			} else if (edge.lines >= 2) {
				const gap = cellSize * 0.06;
				ctx.lineWidth = LINE_WIDTH * 0.7;
				ctx.beginPath();
				ctx.moveTo(x - gap, y1);
				ctx.lineTo(x - gap, y2);
				ctx.moveTo(x + gap, y1);
				ctx.lineTo(x + gap, y2);
				ctx.stroke();
			}
		}
	}
}
