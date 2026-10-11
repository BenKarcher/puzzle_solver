import type { PuzzleState, VariableInstance } from '$lib/model/types';

const DEFAULT_GIVEN_COLOR = '#1a4fa0';
const DEFAULT_USER_COLOR = '#3b82f6';
const BORDER_WIDTH = 4;

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

export function drawBordersLayer(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	const borderVars = puzzle.variables.filter(
		(v) => v.kind === 'border' && v.render !== 'invisible'
	);
	if (borderVars.length === 0) return;

	const { rows, cols } = puzzle.dimensions;
	const linesAlsoEnabled = puzzle.variables.some(
		(v) => v.kind === 'line' && v.render !== 'invisible'
	);
	const K = borderVars.length;

	for (let k = 0; k < K; k++) {
		const v = borderVars[k];
		const grid = puzzle.varData[v.id];
		if (!grid) continue;
		// Parallel offset so multiple border variables stay distinguishable
		const perp = (k - (K - 1) / 2) * (BORDER_WIDTH + 1);

		// Horizontal edges: h[r][c] = edge going right from node (r,c)
		for (let r = 0; r <= rows; r++) {
			for (let c = 0; c < cols; c++) {
				const s = grid.h?.[r]?.[c];
				if (!s || s.value === null) continue;

				const x1 = offsetX + c * cellSize;
				const x2 = offsetX + (c + 1) * cellSize;
				const y = offsetY + r * cellSize + perp;

				if (s.value === true) {
					ctx.strokeStyle = strokeFor(v, s.isGiven);
					ctx.lineWidth = BORDER_WIDTH;
					ctx.beginPath();
					ctx.moveTo(x1, y);
					ctx.lineTo(x2, y);
					ctx.stroke();
				} else {
					// X marks match the border variable's stroke color
					const falseColor = strokeFor(v, s.isGiven);
					if (linesAlsoEnabled) {
						// Quarter-edge inset: clear of the midpoint line-Xs AND of the
						// corner nodes where neighboring edges' Xs would pile up
						const inset = (x2 - x1) * 0.25;
						drawSmallX(ctx, x1 + inset, y, cellSize * 0.07, falseColor);
						drawSmallX(ctx, x2 - inset, y, cellSize * 0.07, falseColor);
					} else {
						drawSmallX(ctx, (x1 + x2) / 2, y, cellSize * 0.08, falseColor);
					}
				}
			}
		}

		// Vertical edges: v[r][c] = edge going down from node (r,c)
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c <= cols; c++) {
				const s = grid.v?.[r]?.[c];
				if (!s || s.value === null) continue;

				const x = offsetX + c * cellSize + perp;
				const y1 = offsetY + r * cellSize;
				const y2 = offsetY + (r + 1) * cellSize;

				if (s.value === true) {
					ctx.strokeStyle = strokeFor(v, s.isGiven);
					ctx.lineWidth = BORDER_WIDTH;
					ctx.beginPath();
					ctx.moveTo(x, y1);
					ctx.lineTo(x, y2);
					ctx.stroke();
				} else {
					// X marks match the border variable's stroke color
					const falseColor = strokeFor(v, s.isGiven);
					if (linesAlsoEnabled) {
						// Quarter-edge inset: clear of the midpoint line-Xs AND of the
						// corner nodes where neighboring edges' Xs would pile up
						const inset = (y2 - y1) * 0.25;
						drawSmallX(ctx, x, y1 + inset, cellSize * 0.07, falseColor);
						drawSmallX(ctx, x, y2 - inset, cellSize * 0.07, falseColor);
					} else {
						drawSmallX(ctx, x, (y1 + y2) / 2, cellSize * 0.08, falseColor);
					}
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
