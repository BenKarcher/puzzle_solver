import type { PuzzleState } from '$lib/model/types';

const SHADED_COLOR = 'rgba(100, 100, 100, 0.6)';
const GIVEN_SHADED_COLOR = '#222222';
const UNSHADED_COLOR = 'rgba(0, 200, 0, 0.1)';
const GIVEN_UNSHADED_COLOR = 'rgba(0, 140, 0, 0.5)';

export function drawShadingLayer(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	if (!puzzle.solutionSpaces.shading.enabled) return;

	const { rows, cols } = puzzle.dimensions;

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const cell = puzzle.cells[r][c];
			if (cell.shaded === null) continue;

			const x = offsetX + c * cellSize;
			const y = offsetY + r * cellSize;

			if (cell.shaded === true) {
				ctx.fillStyle = cell.shadedIsGiven ? GIVEN_SHADED_COLOR : SHADED_COLOR;
			} else {
				ctx.fillStyle = cell.shadedIsGiven ? GIVEN_UNSHADED_COLOR : UNSHADED_COLOR;
			}
			ctx.fillRect(x, y, cellSize, cellSize);
		}
	}
}
