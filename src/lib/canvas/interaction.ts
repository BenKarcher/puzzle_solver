import type { CellCoord, AppMode, ActiveTool } from '$lib/model/types';
import type { GridLayout } from './GridRenderer';
import { puzzleStore } from '$lib/state/puzzle.svelte';
import { selection } from '$lib/state/selection.svelte';
import { ui } from '$lib/state/ui.svelte';

// Track the shading value being painted during a drag
let shadingDragValue: boolean | null = null;

export function pixelToCell(
	x: number,
	y: number,
	layout: GridLayout,
	rows: number,
	cols: number
): CellCoord | null {
	const col = Math.floor((x - layout.offsetX) / layout.cellSize);
	const row = Math.floor((y - layout.offsetY) / layout.cellSize);
	if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
	return { row, col };
}

export function handleCanvasMouseDown(
	e: MouseEvent,
	layout: GridLayout
): void {
	const { rows, cols } = puzzleStore.puzzle.dimensions;
	const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;
	const cell = pixelToCell(x, y, layout, rows, cols);

	if (!cell) {
		selection.clearSelection();
		if (ui.selectedRuleInstanceId) {
			ui.selectRuleInstance(null);
		}
		return;
	}

	const mode = ui.mode;
	const tool = ui.activeTool;

	// In setting/solving mode with shading tool, toggle shading on click
	if ((mode === 'setting' || mode === 'solving') && tool === 'shading') {
		const isGiven = mode === 'setting';
		const currentCell = puzzleStore.getCell(cell.row, cell.col);

		// In solving mode, don't modify givens
		if (mode === 'solving' && currentCell.shadedIsGiven) return;

		// Determine what the click would set, then use that for the whole drag
		if (currentCell.shaded === true) {
			shadingDragValue = false; // shaded -> unshaded
		} else if (currentCell.shaded === false) {
			shadingDragValue = null; // unshaded -> clear
		} else {
			shadingDragValue = true; // clear -> shaded
		}

		puzzleStore.setCellShading(cell, shadingDragValue, isGiven);
		selection.clearSelection();
		selection.startDrag();
		return;
	}

	// Rule group editing: if a rule instance and group is selected, toggle cell in group
	if (mode === 'setting' && ui.selectedRuleInstanceId) {
		puzzleStore.toggleCellInGroup(ui.selectedRuleInstanceId, ui.selectedGroupIndex, cell);
		return;
	}

	// Default: cell selection
	const addToSelection = e.shiftKey;
	selection.selectCell(cell, addToSelection);
	selection.startDrag();
}

export function handleCanvasMouseMove(
	e: MouseEvent,
	layout: GridLayout
): void {
	if (!selection.isDragging) return;

	const { rows, cols } = puzzleStore.puzzle.dimensions;
	const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;
	const cell = pixelToCell(x, y, layout, rows, cols);

	if (!cell) return;

	const mode = ui.mode;
	const tool = ui.activeTool;

	// Drag shading — apply the same value determined on mousedown
	if ((mode === 'setting' || mode === 'solving') && tool === 'shading') {
		const isGiven = mode === 'setting';
		const currentCell = puzzleStore.getCell(cell.row, cell.col);

		// In solving mode, don't modify givens
		if (mode === 'solving' && currentCell.shadedIsGiven) return;

		// Only apply if the cell isn't already the target value
		if (currentCell.shaded !== shadingDragValue) {
			puzzleStore.setCellShading(cell, shadingDragValue, isGiven);
		}
		return;
	}

	// Drag selection
	selection.addCellToSelection(cell);
}

export function handleCanvasMouseUp(): void {
	selection.endDrag();
	shadingDragValue = null;
}

export function handleKeyDown(e: KeyboardEvent): void {
	// Escape: deselect rule instance
	if (e.key === 'Escape') {
		if (ui.selectedRuleInstanceId) {
			ui.selectRuleInstance(null);
		}
		selection.clearSelection();
		return;
	}

	// Undo/Redo
	if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
		e.preventDefault();
		puzzleStore.undo();
		return;
	}
	if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
		e.preventDefault();
		puzzleStore.redo();
		return;
	}

	const mode = ui.mode;
	const tool = ui.activeTool;
	const cells = selection.cells;

	if (cells.length === 0) return;

	// Delete/Backspace: clear selected cells (respecting givens in solve mode)
	if (e.key === 'Delete' || e.key === 'Backspace') {
		e.preventDefault();
		for (const coord of cells) {
			if (mode === 'region-edit') {
				puzzleStore.setRegionId(coord, 0);
			} else if (mode === 'solving') {
				puzzleStore.clearNonGivens(coord);
			} else {
				puzzleStore.clearCell(coord);
			}
		}
		return;
	}

	// Number input
	const num = parseInt(e.key);
	if (num >= 1 && num <= 9) {
		e.preventDefault();
		const { min, max } = puzzleStore.puzzle.solutionSpaces.numbers;

		if (mode === 'region-edit') {
			for (const cell of cells) {
				puzzleStore.setRegionId(cell, num);
			}
			return;
		}

		if (!puzzleStore.puzzle.solutionSpaces.numbers.enabled) return;
		if (num < min || num > max) return;

		const isGiven = mode === 'setting';
		const isPencilMark = e.ctrlKey || e.metaKey;

		for (const cell of cells) {
			const currentCell = puzzleStore.getCell(cell.row, cell.col);
			// In solving mode, don't overwrite givens
			if (mode === 'solving' && currentCell.numberIsGiven) continue;

			if (isPencilMark && mode === 'solving') {
				puzzleStore.togglePencilMark(cell, num);
			} else {
				puzzleStore.setCellNumber(cell, num, isGiven);
			}
		}
		return;
	}

	// 0 key for region editing
	if (e.key === '0' && mode === 'region-edit') {
		e.preventDefault();
		for (const cell of cells) {
			puzzleStore.setRegionId(cell, 0);
		}
		return;
	}

	// Arrow key navigation
	if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
		e.preventDefault();
		const last = cells[cells.length - 1];
		let newRow = last.row;
		let newCol = last.col;

		switch (e.key) {
			case 'ArrowUp': newRow = Math.max(0, newRow - 1); break;
			case 'ArrowDown': newRow = Math.min(puzzleStore.rows - 1, newRow + 1); break;
			case 'ArrowLeft': newCol = Math.max(0, newCol - 1); break;
			case 'ArrowRight': newCol = Math.min(puzzleStore.cols - 1, newCol + 1); break;
		}

		selection.selectCell({ row: newRow, col: newCol }, e.shiftKey);
	}
}
