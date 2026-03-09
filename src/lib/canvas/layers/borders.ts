import type { PuzzleState } from '$lib/model/types';

const GIVEN_BORDER_COLOR = '#1a4fa0';
const USER_BORDER_COLOR = '#3b82f6';
const GIVEN_FALSE_COLOR = '#991b1b';
const SOLVER_FALSE_COLOR = '#999999';
const BORDER_WIDTH = 4;

export function drawBordersLayer(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	if (!puzzle.solutionSpaces.borders.enabled) return;

	const { rows, cols } = puzzle.dimensions;
	const linesAlsoEnabled = puzzle.solutionSpaces.lines.enabled;

	// Horizontal edges: hEdges[r][c] = edge going right from node (r,c)
	// Node (r,c) is at pixel (offsetX + c*cellSize, offsetY + r*cellSize)
	for (let r = 0; r <= rows; r++) {
		for (let c = 0; c < cols; c++) {
			const edge = puzzle.hEdges[r]?.[c];
			if (!edge) continue;

			const x1 = offsetX + c * cellSize;
			const x2 = offsetX + (c + 1) * cellSize;
			const y = offsetY + r * cellSize;

			if (edge.border === true) {
				ctx.strokeStyle = edge.borderIsGiven ? GIVEN_BORDER_COLOR : USER_BORDER_COLOR;
				ctx.lineWidth = BORDER_WIDTH;
				ctx.beginPath();
				ctx.moveTo(x1, y);
				ctx.lineTo(x2, y);
				ctx.stroke();
			} else if (edge.border === false) {
				const falseColor = edge.borderIsGiven ? GIVEN_FALSE_COLOR : SOLVER_FALSE_COLOR;
				if (linesAlsoEnabled) {
					const inset = (x2 - x1) * 0.1;
					drawSmallX(ctx, x1 + inset, y, cellSize * 0.06, falseColor);
					drawSmallX(ctx, x2 - inset, y, cellSize * 0.06, falseColor);
				} else {
					const midX = (x1 + x2) / 2;
					drawSmallX(ctx, midX, y, cellSize * 0.08, falseColor);
				}
			}
		}
	}

	// Vertical edges: vEdges[r][c] = edge going down from node (r,c)
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c <= cols; c++) {
			const edge = puzzle.vEdges[r]?.[c];
			if (!edge) continue;

			const x = offsetX + c * cellSize;
			const y1 = offsetY + r * cellSize;
			const y2 = offsetY + (r + 1) * cellSize;

			if (edge.border === true) {
				ctx.strokeStyle = edge.borderIsGiven ? GIVEN_BORDER_COLOR : USER_BORDER_COLOR;
				ctx.lineWidth = BORDER_WIDTH;
				ctx.beginPath();
				ctx.moveTo(x, y1);
				ctx.lineTo(x, y2);
				ctx.stroke();
			} else if (edge.border === false) {
				const falseColor = edge.borderIsGiven ? GIVEN_FALSE_COLOR : SOLVER_FALSE_COLOR;
				if (linesAlsoEnabled) {
					const inset = (y2 - y1) * 0.1;
					drawSmallX(ctx, x, y1 + inset, cellSize * 0.06, falseColor);
					drawSmallX(ctx, x, y2 - inset, cellSize * 0.06, falseColor);
				} else {
					const midY = (y1 + y2) / 2;
					drawSmallX(ctx, x, midY, cellSize * 0.08, falseColor);
				}
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
