import type { PuzzleState } from '$lib/model/types';

const SOLUTION_NUMBER_COLOR = '#5555cc';
const SOLUTION_SHADED_COLOR = 'rgba(100, 100, 100, 0.6)';
const SOLUTION_UNSHADED_COLOR = 'rgba(0, 200, 0, 0.1)';

/**
 * Draw a solver solution as an overlay on top of the grid.
 * Only draws values for non-given cells.
 */
export function drawSolutionOverlay(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	solution: Record<string, unknown>,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	const { rows, cols } = puzzle.dimensions;

	// Draw shading from solution
	if (solution.shaded && Array.isArray(solution.shaded)) {
		const shaded = solution.shaded as boolean[][];
		for (let r = 0; r < Math.min(rows, shaded.length); r++) {
			for (let c = 0; c < Math.min(cols, shaded[r].length); c++) {
				const cell = puzzle.cells[r][c];
				if (cell.shadedIsGiven) continue;

				const x = offsetX + c * cellSize;
				const y = offsetY + r * cellSize;

				ctx.fillStyle = shaded[r][c] ? SOLUTION_SHADED_COLOR : SOLUTION_UNSHADED_COLOR;
				ctx.fillRect(x, y, cellSize, cellSize);
			}
		}
	}

	// Draw numbers from solution
	if (solution.grid && Array.isArray(solution.grid)) {
		const grid = solution.grid as number[][];
		for (let r = 0; r < Math.min(rows, grid.length); r++) {
			for (let c = 0; c < Math.min(cols, grid[r].length); c++) {
				const cell = puzzle.cells[r][c];
				if (cell.numberIsGiven) continue;

				const cx = offsetX + c * cellSize + cellSize / 2;
				const cy = offsetY + r * cellSize + cellSize / 2;

				ctx.fillStyle = SOLUTION_NUMBER_COLOR;
				ctx.font = `${cellSize * 0.6}px sans-serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(String(grid[r][c]), cx, cy);
			}
		}
	}
}
