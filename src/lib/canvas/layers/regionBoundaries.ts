import type { PuzzleState } from '$lib/model/types';

const BOUNDARY_COLOR = '#000000';
const BOUNDARY_WIDTH = 3;

/** Draw interior edges as region boundaries in region-edit draw-edges mode. */
export function drawRegionBoundariesLayer(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	const { rows, cols } = puzzle.dimensions;

	ctx.strokeStyle = BOUNDARY_COLOR;
	ctx.lineWidth = BOUNDARY_WIDTH;
	ctx.lineCap = 'round';

	// Interior horizontal edges: hEdges[r][c] for r = 1..rows-1
	for (let r = 1; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			if (puzzle.hEdges[r]?.[c]?.border !== true) continue;
			const x1 = offsetX + c * cellSize;
			const x2 = offsetX + (c + 1) * cellSize;
			const y  = offsetY + r * cellSize;
			ctx.beginPath();
			ctx.moveTo(x1, y);
			ctx.lineTo(x2, y);
			ctx.stroke();
		}
	}

	// Interior vertical edges: vEdges[r][c] for c = 1..cols-1
	for (let r = 0; r < rows; r++) {
		for (let c = 1; c < cols; c++) {
			if (puzzle.vEdges[r]?.[c]?.border !== true) continue;
			const x  = offsetX + c * cellSize;
			const y1 = offsetY + r * cellSize;
			const y2 = offsetY + (r + 1) * cellSize;
			ctx.beginPath();
			ctx.moveTo(x, y1);
			ctx.lineTo(x, y2);
			ctx.stroke();
		}
	}
}
