import type { PuzzleState, AppMode } from '$lib/model/types';

const GIVEN_COLOR = '#000000';
const ENTRY_COLOR = '#5555cc';
const PENCIL_COLOR = '#888888';
const REGION_ID_COLOR = '#999999';

export function drawNumbersLayer(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	mode: AppMode,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	const { rows, cols } = puzzle.dimensions;

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const cell = puzzle.cells[r][c];
			const cx = offsetX + c * cellSize + cellSize / 2;
			const cy = offsetY + r * cellSize + cellSize / 2;

			if (mode === 'region-edit') {
				// Show region IDs
				ctx.fillStyle = REGION_ID_COLOR;
				ctx.font = `bold ${cellSize * 0.5}px sans-serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(String(cell.regionId), cx, cy);
				continue;
			}

			if (!puzzle.solutionSpaces.numbers.enabled) continue;

			if (cell.number !== null) {
				ctx.fillStyle = cell.numberIsGiven ? GIVEN_COLOR : ENTRY_COLOR;
				ctx.font = `${cell.numberIsGiven ? 'bold' : ''} ${cellSize * 0.6}px sans-serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(String(cell.number), cx, cy);
			} else if (cell.pencilMarks.length > 0) {
				const { min, max } = puzzle.solutionSpaces.numbers;
				drawPencilMarks(ctx, cell.pencilMarks, min, max, cx, cy, cellSize);
			}
		}
	}
}

function drawPencilMarks(
	ctx: CanvasRenderingContext2D,
	marks: number[],
	minVal: number,
	maxVal: number,
	cx: number,
	cy: number,
	cellSize: number
): void {
	// N×N grid layout: minVal at top-left, filling left-to-right top-to-bottom
	const count = maxVal - minVal + 1;
	const N = Math.ceil(Math.sqrt(count));

	// Distribute slots evenly across 88% of the cell
	const usable = cellSize * 0.88;
	const slotSize = usable / N;
	const fontSize = Math.max(5, slotSize * 0.72);

	const startX = cx - slotSize * (N - 1) / 2;
	const startY = cy - slotSize * (N - 1) / 2;

	ctx.fillStyle = PENCIL_COLOR;
	ctx.font = `${fontSize}px sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	for (const mark of marks) {
		const idx = mark - minVal;
		if (idx < 0 || idx >= N * N) continue;
		const col = idx % N;
		const row = Math.floor(idx / N);
		const x = startX + col * slotSize;
		const y = startY + row * slotSize;
		ctx.fillText(String(mark), x, y);
	}
}
