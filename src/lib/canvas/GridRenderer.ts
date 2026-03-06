import type { PuzzleState, AppMode, CellCoord, RenderFn } from '$lib/model/types';
import { drawGridLayer } from './layers/grid';
import { drawNumbersLayer } from './layers/numbers';
import { drawShadingLayer } from './layers/shading';
import { drawSelectionLayer } from './layers/selection';
import { drawBordersLayer } from './layers/borders';
import { drawLinesLayer } from './layers/lines';
import { drawRulesLayer } from './layers/rules';
import { drawSolutionOverlay } from './layers/solutionOverlay';
import { drawCandidateOverlay } from './layers/candidateOverlay';
import type { CandidateResult } from '$lib/solver/candidates';

const PADDING = 20;
const BG_COLOR = '#ffffff';

export interface RenderContext {
	puzzle: PuzzleState;
	mode: AppMode;
	selectedCells: CellCoord[];
	ruleRenderers: Map<string, RenderFn>;
	highlightedCells?: Map<string, string>;
	displaySolution?: Record<string, unknown> | null;
	displayCandidates?: CandidateResult | null;
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
	const { puzzle, mode, selectedCells, ruleRenderers } = renderCtx;
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
	drawRulesLayer(ctx, puzzle, ruleRenderers, cellSize, offsetX, offsetY);
	drawNumbersLayer(ctx, puzzle, mode, cellSize, offsetX, offsetY);

	// Solution overlay (drawn on top of everything except selection)
	if (renderCtx.displaySolution) {
		drawSolutionOverlay(ctx, puzzle, renderCtx.displaySolution, cellSize, offsetX, offsetY);
	}

	// Candidate overlay
	if (renderCtx.displayCandidates) {
		drawCandidateOverlay(ctx, puzzle, renderCtx.displayCandidates, cellSize, offsetX, offsetY);
	}

	return layout;
}
