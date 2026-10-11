import type { PuzzleState, VariableInstance } from '$lib/model/types';

const DEFAULT_SHADED_COLOR = '#646464';
const UNSHADED_COLOR = 'rgba(0, 200, 0, 0.1)';
const GIVEN_UNSHADED_COLOR = 'rgba(0, 140, 0, 0.5)';

function shadingVars(puzzle: PuzzleState): VariableInstance[] {
	return puzzle.variables.filter((v) => v.kind === 'boolean' && v.render === 'shading');
}

function hexToRgba(hex: string, alpha: number): string {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex);
	if (!m) return hex;
	const n = parseInt(m[1], 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Fill style for a shading variable — preserves the classic grey look when no color is set */
function shadeFill(v: VariableInstance, isGiven: boolean): string {
	if (!v.color) {
		return isGiven ? '#222222' : 'rgba(100, 100, 100, 0.6)';
	}
	return isGiven ? v.color : hexToRgba(v.color, 0.6);
}

export function drawShadingLayer(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	const vars = shadingVars(puzzle);
	if (vars.length === 0) return;

	const { rows, cols } = puzzle.dimensions;
	const single = vars.length === 1;

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const x = offsetX + c * cellSize;
			const y = offsetY + r * cellSize;

			// Collect this cell's states per shading variable
			const trueEntries: { v: VariableInstance; isGiven: boolean }[] = [];
			const falseEntries: { v: VariableInstance; isGiven: boolean; idx: number }[] = [];
			for (let i = 0; i < vars.length; i++) {
				const s = puzzle.varData[vars[i].id]?.cells?.[r]?.[c];
				if (!s || s.value === null) continue;
				if (s.value === true) trueEntries.push({ v: vars[i], isGiven: s.isGiven });
				else falseEntries.push({ v: vars[i], isGiven: s.isGiven, idx: i });
			}

			// Shaded fills: full cell for one, radial slices for several
			if (trueEntries.length === 1) {
				const { v, isGiven } = trueEntries[0];
				ctx.fillStyle = shadeFill(v, isGiven);
				ctx.fillRect(x, y, cellSize, cellSize);
			} else if (trueEntries.length > 1) {
				const cx = x + cellSize / 2;
				const cy = y + cellSize / 2;
				const radius = cellSize; // clipped to the cell rect below
				const K = trueEntries.length;
				ctx.save();
				ctx.beginPath();
				ctx.rect(x, y, cellSize, cellSize);
				ctx.clip();
				for (let i = 0; i < K; i++) {
					const { v, isGiven } = trueEntries[i];
					const start = -Math.PI / 2 + (i * 2 * Math.PI) / K;
					const end = start + (2 * Math.PI) / K;
					ctx.fillStyle = shadeFill(v, isGiven);
					ctx.beginPath();
					ctx.moveTo(cx, cy);
					ctx.arc(cx, cy, radius, start, end);
					ctx.closePath();
					ctx.fill();
				}
				ctx.restore();
			}

			// Explicit-false marks
			for (const { v, isGiven, idx } of falseEntries) {
				if (single) {
					// Single shading variable: keep the classic green tint
					ctx.fillStyle = isGiven ? GIVEN_UNSHADED_COLOR : UNSHADED_COLOR;
					ctx.fillRect(x, y, cellSize, cellSize);
				} else {
					// Multiple: small × in the variable's color near its corner (NW,NE,SW,SE cycle)
					const base = v.color ?? DEFAULT_SHADED_COLOR;
					const inset = cellSize * 0.18;
					const cornerX = x + ((idx % 2) === 0 ? inset : cellSize - inset);
					const cornerY = y + (idx % 4 < 2 ? inset : cellSize - inset);
					const size = cellSize * 0.07;
					ctx.strokeStyle = isGiven ? base : hexToRgba(base, 0.6);
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.moveTo(cornerX - size, cornerY - size);
					ctx.lineTo(cornerX + size, cornerY + size);
					ctx.moveTo(cornerX + size, cornerY - size);
					ctx.lineTo(cornerX - size, cornerY + size);
					ctx.stroke();
				}
			}
		}
	}
}
