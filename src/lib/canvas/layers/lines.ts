import type { PuzzleState, VariableInstance } from '$lib/model/types';

const DEFAULT_GIVEN_COLOR = '#1e3a5f';
const DEFAULT_USER_COLOR = '#3b82f6';
const PENCIL_MARK_COLOR = '#999999';
const LINE_WIDTH = 3;

function hexToRgba(hex: string, alpha: number): string {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex);
	if (!m) return hex;
	const n = parseInt(m[1], 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function strokeFor(v: VariableInstance, isGiven: boolean): string {
	if (!v.color) return isGiven ? DEFAULT_GIVEN_COLOR : DEFAULT_USER_COLOR;
	return isGiven ? v.color : hexToRgba(v.color, 0.65);
}

export function drawLinesLayer(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	const lineVars = puzzle.variables.filter(
		(v) => v.kind === 'line' && v.render !== 'invisible'
	);
	if (lineVars.length === 0) return;

	const { rows, cols } = puzzle.dimensions;
	const bordersAlsoEnabled = puzzle.variables.some(
		(v) => v.kind === 'border' && v.render !== 'invisible'
	);
	const K = lineVars.length;

	ctx.lineCap = 'round';

	for (let k = 0; k < K; k++) {
		const v = lineVars[k];
		const grid = puzzle.varData[v.id];
		if (!grid) continue;
		const maxLines = v.maxLinesPerPair ?? 1;
		// Parallel offset so multiple line variables draw side by side
		const perp = (k - (K - 1) / 2) * cellSize * 0.14;
		// Pencil marks are wider than strokes — spread variables further apart
		const markPerp = (k - (K - 1) / 2) * cellSize * 0.26;

		// Horizontal connections (cells side by side): stored in the v-grid
		// v[r][c] with c=1..cols-1 are interior vertical boundaries
		for (let r = 0; r < rows; r++) {
			for (let c = 1; c < cols; c++) {
				const s = grid.v?.[r]?.[c];
				if (!s) continue;

				const center1X = offsetX + (c - 1) * cellSize + cellSize / 2;
				const center2X = offsetX + c * cellSize + cellSize / 2;
				const centerY = offsetY + r * cellSize + cellSize / 2 + perp;
				const edgeX = offsetX + c * cellSize;

				if (s.value !== null && typeof s.value === 'number') {
					if (s.value > 0) {
						ctx.strokeStyle = strokeFor(v, s.isGiven);
						drawLineMarks(ctx, center1X, centerY, center2X, centerY, edgeX, centerY, s.value, maxLines, cellSize, 'h');
					} else {
						drawFalseLineH(ctx, v, edgeX, centerY, cellSize, bordersAlsoEnabled, s.isGiven);
					}
				} else if (s.marks.length > 0) {
					const markY = offsetY + r * cellSize + cellSize / 2 + markPerp;
					drawPencilMarks(ctx, v, edgeX, markY, s.marks, cellSize, 'h');
				}
			}
		}

		// Vertical connections (cells above/below): stored in the h-grid
		// h[r][c] with r=1..rows-1 are interior horizontal boundaries
		for (let r = 1; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const s = grid.h?.[r]?.[c];
				if (!s) continue;

				const centerX = offsetX + c * cellSize + cellSize / 2 + perp;
				const center1Y = offsetY + (r - 1) * cellSize + cellSize / 2;
				const center2Y = offsetY + r * cellSize + cellSize / 2;
				const edgeY = offsetY + r * cellSize;

				if (s.value !== null && typeof s.value === 'number') {
					if (s.value > 0) {
						ctx.strokeStyle = strokeFor(v, s.isGiven);
						drawLineMarks(ctx, centerX, center1Y, centerX, center2Y, centerX, edgeY, s.value, maxLines, cellSize, 'v');
					} else {
						drawFalseLineV(ctx, v, centerX, edgeY, cellSize, bordersAlsoEnabled, s.isGiven);
					}
				} else if (s.marks.length > 0) {
					const markX = offsetX + c * cellSize + cellSize / 2 + markPerp;
					drawPencilMarks(ctx, v, markX, edgeY, s.marks, cellSize, 'v');
				}
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
	v: VariableInstance,
	edgeX: number, edgeY: number,
	cellSize: number,
	bordersAlsoEnabled: boolean,
	isGiven: boolean
): void {
	// X marks match the line variable's stroke color
	ctx.strokeStyle = strokeFor(v, isGiven);
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
	v: VariableInstance,
	edgeX: number, edgeY: number,
	cellSize: number,
	bordersAlsoEnabled: boolean,
	isGiven: boolean
): void {
	// X marks match the line variable's stroke color
	ctx.strokeStyle = strokeFor(v, isGiven);
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
	v: VariableInstance,
	edgeX: number, edgeY: number,
	marks: number[],
	cellSize: number,
	orientation: 'h' | 'v'
): void {
	// Candidate marks tinted with the variable's color so layers stay distinguishable
	ctx.fillStyle = v.color ? hexToRgba(v.color, 0.8) : PENCIL_MARK_COLOR;
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
