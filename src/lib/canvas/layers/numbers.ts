import type { AppMode, PuzzleState, VariableInstance } from '$lib/model/types';

const GIVEN_COLOR = '#000000';
const ENTRY_COLOR = '#5555cc';
const PENCIL_COLOR = '#888888';
const REGION_ID_COLOR = '#999999';

/**
 * Variables that occupy a cell-content slot: every visible number variable and
 * every boolean variable rendered as objects. Slot order = variable list order.
 */
export function cellContentVars(puzzle: PuzzleState): VariableInstance[] {
	return puzzle.variables.filter(
		(v) =>
			(v.kind === 'number' && v.render !== 'invisible') ||
			(v.kind === 'boolean' && v.render === 'objects')
	);
}

/** Slot grid dimension: N×N sub-cells, N = ceil(sqrt(slot count)) */
export function slotGridN(puzzle: PuzzleState): number {
	return Math.max(1, Math.ceil(Math.sqrt(cellContentVars(puzzle).length)));
}

function objectEmoji(v: VariableInstance, value: number | boolean): string {
	if (v.kind === 'boolean') return v.emojis?.[0] ?? '★';
	const idx = (value as number) - (v.min ?? 1);
	return v.emojis?.[idx] ?? String(value);
}

/** Cell-content layer: digits, placed objects, and pencil marks in the sub-cell slot pool. */
export function drawNumbersLayer(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	mode: AppMode,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	const { rows, cols } = puzzle.dimensions;

	if (mode === 'region-edit') {
		ctx.fillStyle = REGION_ID_COLOR;
		ctx.font = `bold ${cellSize * 0.5}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const cx = offsetX + c * cellSize + cellSize / 2;
				const cy = offsetY + r * cellSize + cellSize / 2;
				ctx.fillText(String(puzzle.cells[r][c].regionId), cx, cy);
			}
		}
		return;
	}

	const slotVars = cellContentVars(puzzle);
	if (slotVars.length === 0) return;
	const N = Math.ceil(Math.sqrt(slotVars.length));
	const slotSize = cellSize / N;

	for (let si = 0; si < slotVars.length; si++) {
		const v = slotVars[si];
		const grid = puzzle.varData[v.id]?.cells;
		if (!grid) continue;
		const slotRow = Math.floor(si / N);
		const slotCol = si % N;

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const s = grid[r]?.[c];
				if (!s) continue;

				// Slot center for this variable within the cell
				const cx = offsetX + c * cellSize + (slotCol + 0.5) * slotSize;
				const cy = offsetY + r * cellSize + (slotRow + 0.5) * slotSize;

				if (v.kind === 'boolean') {
					// Object-rendered boolean: emoji when true, faint × when explicitly false
					if (s.value === true) {
						ctx.globalAlpha = s.isGiven ? 1 : 0.75;
						ctx.font = `${slotSize * 0.6}px sans-serif`;
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillText(objectEmoji(v, true), cx, cy);
						ctx.globalAlpha = 1;
					} else if (s.value === false) {
						drawFalseMark(ctx, cx, cy, slotSize * 0.12, s.isGiven);
					}
					continue;
				}

				// Number variable
				if (s.value !== null) {
					if (v.render === 'objects') {
						ctx.globalAlpha = s.isGiven ? 1 : 0.75;
						ctx.font = `${slotSize * 0.6}px sans-serif`;
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillText(objectEmoji(v, s.value), cx, cy);
						ctx.globalAlpha = 1;
					} else {
						ctx.fillStyle = s.isGiven ? GIVEN_COLOR : ENTRY_COLOR;
						ctx.font = `${s.isGiven ? 'bold' : ''} ${slotSize * 0.6}px sans-serif`;
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillText(String(s.value), cx, cy);
					}
				} else if (s.marks.length > 0) {
					drawPencilMarks(ctx, v, s.marks, cx, cy, slotSize);
				}
			}
		}
	}
}

function drawFalseMark(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	size: number,
	isGiven: boolean
): void {
	ctx.strokeStyle = isGiven ? '#991b1b' : '#bbbbbb';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(cx - size, cy - size);
	ctx.lineTo(cx + size, cy + size);
	ctx.moveTo(cx + size, cy - size);
	ctx.lineTo(cx - size, cy + size);
	ctx.stroke();
}

function drawPencilMarks(
	ctx: CanvasRenderingContext2D,
	v: VariableInstance,
	marks: number[],
	cx: number,
	cy: number,
	slotSize: number
): void {
	// N×N grid layout inside the slot: min at top-left, filling left-to-right top-to-bottom
	const minVal = v.min ?? 1;
	const maxVal = v.max ?? 9;
	const count = maxVal - minVal + 1;
	const N = Math.ceil(Math.sqrt(count));

	// Distribute mark positions evenly across 88% of the slot
	const usable = slotSize * 0.88;
	const markSlot = usable / N;
	const fontSize = Math.max(5, markSlot * 0.72);

	const startX = cx - markSlot * (N - 1) / 2;
	const startY = cy - markSlot * (N - 1) / 2;

	ctx.fillStyle = PENCIL_COLOR;
	ctx.font = `${fontSize}px sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	for (const mark of marks) {
		const idx = mark - minVal;
		if (idx < 0 || idx >= N * N) continue;
		const col = idx % N;
		const row = Math.floor(idx / N);
		const x = startX + col * markSlot;
		const y = startY + row * markSlot;
		const label = v.render === 'objects' ? objectEmoji(v, mark) : String(mark);
		ctx.fillText(label, x, y);
	}
}
