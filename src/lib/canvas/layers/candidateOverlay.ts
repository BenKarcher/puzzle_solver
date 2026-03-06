import type { PuzzleState } from '$lib/model/types';
import type { CandidateResult } from '$lib/solver/candidates';

const CANDIDATE_NUMBER_COLOR = '#888888';
const CANDIDATE_SHADED_COLOR = 'rgba(100, 100, 100, 0.6)';
const CANDIDATE_UNSHADED_COLOR = 'rgba(0, 200, 0, 0.35)';

export function drawCandidateOverlay(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	candidates: CandidateResult,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	const { rows, cols } = puzzle.dimensions;

	// Shading candidates
	if (candidates.shading) {
		for (let r = 0; r < Math.min(rows, candidates.shading.length); r++) {
			for (let c = 0; c < Math.min(cols, candidates.shading[r].length); c++) {
				const cell = puzzle.cells[r][c];
				if (cell.shadedIsGiven) continue;

				const val = candidates.shading[r][c];
				if (val === null || val === 'both') continue;

				const x = offsetX + c * cellSize;
				const y = offsetY + r * cellSize;

				ctx.fillStyle = val === 'true' ? CANDIDATE_SHADED_COLOR : CANDIDATE_UNSHADED_COLOR;
				ctx.fillRect(x, y, cellSize, cellSize);
			}
		}
	}

	// Number candidates — render as pencil marks
	if (candidates.numbers) {
		ctx.fillStyle = CANDIDATE_NUMBER_COLOR;

		for (let r = 0; r < Math.min(rows, candidates.numbers.length); r++) {
			for (let c = 0; c < Math.min(cols, candidates.numbers[r].length); c++) {
				const cell = puzzle.cells[r][c];
				if (cell.numberIsGiven) continue;

				const marks = candidates.numbers[r][c];
				if (marks.length === 0) continue;

				const cx = offsetX + c * cellSize + cellSize / 2;
				const cy = offsetY + r * cellSize + cellSize / 2;

				if (marks.length === 1) {
					// Single candidate — show as a full number
					ctx.font = `${cellSize * 0.6}px sans-serif`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillText(String(marks[0]), cx, cy);
				} else {
					// Multiple candidates — show as small pencil marks
					const fontSize = cellSize * 0.22;
					ctx.font = `${fontSize}px sans-serif`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';

					const gridCols = 3;
					const spacing = cellSize * 0.28;
					const startX = cx - spacing;
					const startY = cy - spacing;

					for (const mark of marks) {
						const idx = mark - 1;
						const mc = idx % gridCols;
						const mr = Math.floor(idx / gridCols);
						const x = startX + mc * spacing;
						const y = startY + mr * spacing;
						ctx.fillText(String(mark), x, y);
					}
				}
			}
		}
	}
}
