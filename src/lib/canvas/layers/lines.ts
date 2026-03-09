import type { PuzzleState } from '$lib/model/types';

const GIVEN_LINE_COLOR = '#1e3a5f';
const USER_LINE_COLOR = '#3b82f6';
const GIVEN_FALSE_COLOR = '#991b1b';
const SOLVER_FALSE_COLOR = '#999999';
const PENCIL_MARK_COLOR = '#999999';
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
	const maxLines = puzzle.solutionSpaces.lines.maxLinesPerPair;
	const bordersAlsoEnabled = puzzle.solutionSpaces.borders.enabled;

	ctx.lineCap = 'round';

	// Horizontal connections (cells side by side): stored in vEdges
	// vEdges[r][c] with c=1..cols-1 are interior vertical boundaries
	for (let r = 0; r < rows; r++) {
		for (let c = 1; c < cols; c++) {
			const edge = puzzle.vEdges[r]?.[c];
			if (!edge) continue;

			const center1X = offsetX + (c - 1) * cellSize + cellSize / 2;
			const center2X = offsetX + c * cellSize + cellSize / 2;
			const centerY = offsetY + r * cellSize + cellSize / 2;
			const edgeX = offsetX + c * cellSize;

			if (edge.lines !== null) {
				if (edge.lines > 0) {
					ctx.strokeStyle = edge.lineIsGiven ? GIVEN_LINE_COLOR : USER_LINE_COLOR;
					drawLineMarks(ctx, center1X, centerY, center2X, centerY, edgeX, centerY, edge.lines, maxLines, cellSize, 'h');
				} else {
					drawFalseLineH(ctx, edgeX, centerY, cellSize, bordersAlsoEnabled, edge.lineIsGiven);
				}
			} else if (edge.linePencilMarks.length > 0) {
				drawPencilMarks(ctx, edgeX, centerY, edge.linePencilMarks, cellSize, 'h');
			}
		}
	}

	// Vertical connections (cells above/below): stored in hEdges
	// hEdges[r][c] with r=1..rows-1 are interior horizontal boundaries
	for (let r = 1; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const edge = puzzle.hEdges[r]?.[c];
			if (!edge) continue;

			const centerX = offsetX + c * cellSize + cellSize / 2;
			const center1Y = offsetY + (r - 1) * cellSize + cellSize / 2;
			const center2Y = offsetY + r * cellSize + cellSize / 2;
			const edgeY = offsetY + r * cellSize;

			if (edge.lines !== null) {
				if (edge.lines > 0) {
					ctx.strokeStyle = edge.lineIsGiven ? GIVEN_LINE_COLOR : USER_LINE_COLOR;
					drawLineMarks(ctx, centerX, center1Y, centerX, center2Y, centerX, edgeY, edge.lines, maxLines, cellSize, 'v');
				} else {
					drawFalseLineV(ctx, centerX, edgeY, cellSize, bordersAlsoEnabled, edge.lineIsGiven);
				}
			} else if (edge.linePencilMarks.length > 0) {
				drawPencilMarks(ctx, centerX, edgeY, edge.linePencilMarks, cellSize, 'v');
			}
		}
	}
}

function drawLineMarks(
	ctx: CanvasRenderingContext2D,
	c1x: number, c1y: number,
	c2x: number, c2y: number,
	edgeX: number, edgeY: number,
	count: number, maxLines: number,
	cellSize: number,
	orientation: 'h' | 'v'
): void {
	if (maxLines <= 1) {
		ctx.lineWidth = LINE_WIDTH;
		ctx.beginPath();
		ctx.moveTo(c1x, c1y);
		ctx.lineTo(c2x, c2y);
		ctx.stroke();
	} else {
		const tickLen = cellSize * 0.2;
		ctx.lineWidth = LINE_WIDTH * 0.7;
		const spacing = cellSize * 0.12;
		const totalWidth = (count - 1) * spacing;
		const startOffset = -totalWidth / 2;

		for (let i = 0; i < count; i++) {
			const offset = startOffset + i * spacing;
			ctx.beginPath();
			if (orientation === 'h') {
				ctx.moveTo(edgeX - tickLen, edgeY + offset);
				ctx.lineTo(edgeX + tickLen, edgeY + offset);
			} else {
				ctx.moveTo(edgeX + offset, edgeY - tickLen);
				ctx.lineTo(edgeX + offset, edgeY + tickLen);
			}
			ctx.stroke();
		}
	}
}

function drawFalseLineH(
	ctx: CanvasRenderingContext2D,
	edgeX: number, edgeY: number,
	cellSize: number,
	bordersAlsoEnabled: boolean,
	isGiven: boolean
): void {
	ctx.strokeStyle = isGiven ? GIVEN_FALSE_COLOR : SOLVER_FALSE_COLOR;
	ctx.lineWidth = 1.5;
	const xSize = cellSize * 0.06;

	if (bordersAlsoEnabled) {
		const offset = cellSize * 0.15;
		drawSmallX(ctx, edgeX - offset, edgeY, xSize);
		drawSmallX(ctx, edgeX + offset, edgeY, xSize);
	} else {
		drawSmallX(ctx, edgeX, edgeY, cellSize * 0.08);
	}
}

function drawFalseLineV(
	ctx: CanvasRenderingContext2D,
	edgeX: number, edgeY: number,
	cellSize: number,
	bordersAlsoEnabled: boolean,
	isGiven: boolean
): void {
	ctx.strokeStyle = isGiven ? GIVEN_FALSE_COLOR : SOLVER_FALSE_COLOR;
	ctx.lineWidth = 1.5;
	const xSize = cellSize * 0.06;

	if (bordersAlsoEnabled) {
		const offset = cellSize * 0.15;
		drawSmallX(ctx, edgeX, edgeY - offset, xSize);
		drawSmallX(ctx, edgeX, edgeY + offset, xSize);
	} else {
		drawSmallX(ctx, edgeX, edgeY, cellSize * 0.08);
	}
}

function drawPencilMarks(
	ctx: CanvasRenderingContext2D,
	edgeX: number, edgeY: number,
	marks: number[],
	cellSize: number,
	orientation: 'h' | 'v'
): void {
	ctx.fillStyle = PENCIL_MARK_COLOR;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const fontSize = Math.max(8, cellSize * 0.2);
	ctx.font = `${fontSize}px sans-serif`;

	const spacing = fontSize * 0.9;
	const totalWidth = (marks.length - 1) * spacing;
	const startOffset = -totalWidth / 2;

	for (let i = 0; i < marks.length; i++) {
		const offset = startOffset + i * spacing;
		if (orientation === 'h') {
			// Horizontal edge: spread numbers vertically along the edge
			ctx.fillText(String(marks[i]), edgeX, edgeY + offset);
		} else {
			// Vertical edge: spread numbers horizontally along the edge
			ctx.fillText(String(marks[i]), edgeX + offset, edgeY);
		}
	}
}

function drawSmallX(
	ctx: CanvasRenderingContext2D,
	cx: number, cy: number,
	size: number
): void {
	ctx.beginPath();
	ctx.moveTo(cx - size, cy - size);
	ctx.lineTo(cx + size, cy + size);
	ctx.moveTo(cx + size, cy - size);
	ctx.lineTo(cx - size, cy + size);
	ctx.stroke();
}
