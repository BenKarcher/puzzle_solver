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
				drawPencilMarks(ctx, cell.pencilMarks, puzzle.solutionSpaces.numbers.max, cx, cy, cellSize);
			}
		}
	}
}

function drawPencilMarks(
	ctx: CanvasRenderingContext2D,
	marks: number[],
	maxVal: number,
	cx: number,
	cy: number,
	cellSize: number
): void {
	ctx.fillStyle = PENCIL_COLOR;
	const fontSize = cellSize * 0.22;
	ctx.font = `${fontSize}px sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	// Arrange in a 3x3 grid for values 1-9
	const cols = 3;
	const rows = Math.ceil(maxVal / cols);
	const spacing = cellSize * 0.28;
	const startX = cx - spacing;
	const startY = cy - spacing * (rows - 1) / 2;

	for (const mark of marks) {
		const idx = mark - 1;
		const col = idx % cols;
		const row = Math.floor(idx / cols);
		const x = startX + col * spacing;
		const y = startY + row * spacing;
		ctx.fillText(String(mark), x, y);
	}
}
