import type { PuzzleState, AppMode, CellCoord, RenderFn } from '$lib/model/types';
import { drawGridLayer } from './layers/grid';
import { drawNumbersLayer } from './layers/numbers';
import { drawShadingLayer } from './layers/shading';
import { drawSelectionLayer } from './layers/selection';
import { drawBordersLayer } from './layers/borders';
import { drawLinesLayer } from './layers/lines';
import { drawRulesLayer } from './layers/rules';
import { drawRegionBoundariesLayer } from './layers/regionBoundaries';

const PADDING = 20;
const BG_COLOR = '#ffffff';

export interface RenderContext {
	puzzle: PuzzleState;
	mode: AppMode;
	selectedCells: CellCoord[];
	ruleRenderers: Map<string, RenderFn>;
	highlightedCells?: Map<string, string>;
	noSolution?: boolean;
}

export interface GridLayout {
	cellSize: number;
	offsetX: number;
	offsetY: number;
}

export function computeLayout(
	canvasWidth: number,
	canvasHeight: number,
	rows: number,
	cols: number
): GridLayout {
	const availW = canvasWidth - PADDING * 2;
	const availH = canvasHeight - PADDING * 2;
	const cellSize = Math.floor(Math.min(availW / cols, availH / rows));
	const gridW = cellSize * cols;
	const gridH = cellSize * rows;
	const offsetX = Math.floor((canvasWidth - gridW) / 2);
	const offsetY = Math.floor((canvasHeight - gridH) / 2);
	return { cellSize, offsetX, offsetY };
}

export function renderGrid(
	ctx: CanvasRenderingContext2D,
	canvasWidth: number,
	canvasHeight: number,
	renderCtx: RenderContext
): GridLayout {
	const { puzzle, mode, selectedCells, ruleRenderers, noSolution } = renderCtx;
	const { rows, cols } = puzzle.dimensions;

	const layout = computeLayout(canvasWidth, canvasHeight, rows, cols);
	const { cellSize, offsetX, offsetY } = layout;

	// Clear
	ctx.fillStyle = BG_COLOR;
	ctx.fillRect(0, 0, canvasWidth, canvasHeight);

	// Draw layers in order (back to front)
	drawShadingLayer(ctx, puzzle, cellSize, offsetX, offsetY);
	drawSelectionLayer(ctx, selectedCells, cellSize, offsetX, offsetY);

	// Rule group highlighting
	if (renderCtx.highlightedCells) {
		for (const [key, color] of renderCtx.highlightedCells) {
			const [r, c] = key.split(',').map(Number);
			const x = offsetX + c * cellSize;
			const y = offsetY + r * cellSize;
			ctx.fillStyle = color;
			ctx.fillRect(x, y, cellSize, cellSize);
		}
	}

	drawGridLayer(ctx, puzzle, cellSize, offsetX, offsetY);
	drawBordersLayer(ctx, puzzle, cellSize, offsetX, offsetY);
	drawLinesLayer(ctx, puzzle, cellSize, offsetX, offsetY);
	if (mode === 'region-edit') {
		drawRegionBoundariesLayer(ctx, puzzle, cellSize, offsetX, offsetY);
	}
	drawRulesLayer(ctx, puzzle, ruleRenderers, cellSize, offsetX, offsetY);
	drawNumbersLayer(ctx, puzzle, mode, cellSize, offsetX, offsetY);

	if (noSolution) {
		const borderWidth = Math.max(4, Math.round(cellSize * 0.08));
		ctx.save();
		ctx.strokeStyle = '#d32f2f';
		ctx.lineWidth = borderWidth;
		ctx.strokeRect(
			offsetX - borderWidth / 2,
			offsetY - borderWidth / 2,
			cols * cellSize + borderWidth,
			rows * cellSize + borderWidth,
		);
		ctx.restore();
	}

	return layout;
}
