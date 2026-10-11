import type { CellCoord, EdgeCoord, VariableInstance } from '$lib/model/types';
import type { GridLayout } from './GridRenderer';
import { puzzleStore } from '$lib/state/puzzle.svelte';
import { selection } from '$lib/state/selection.svelte';
import { ui } from '$lib/state/ui.svelte';
import { getRuleById } from '$lib/rules/registry';

/** The variable instance the grid tools currently edit (null when none) */
function activeVar(): VariableInstance | null {
	if (!ui.activeVarId) return null;
	return puzzleStore.getVariable(ui.activeVarId) ?? null;
}

/** True when the currently-edited rule group is cell-less (maxSize === 0). */
function selectedGroupIsCellless(): boolean {
	if (!ui.selectedRuleInstanceId) return false;
	const inst = puzzleStore.puzzle.localRules.find((r) => r.id === ui.selectedRuleInstanceId);
	if (!inst) return false;
	const cfg = getRuleById(inst.ruleId)?.config.groups?.[ui.selectedGroupIndex];
	return cfg?.maxSize === 0;
}

/** True when the currently-edited rule group is a region group (isRegion === true). */
function selectedGroupIsRegion(): boolean {
	if (!ui.selectedRuleInstanceId) return false;
	const inst = puzzleStore.puzzle.localRules.find((r) => r.id === ui.selectedRuleInstanceId);
	if (!inst) return false;
	const cfg = getRuleById(inst.ruleId)?.config.groups?.[ui.selectedGroupIndex];
	return cfg?.isRegion === true;
}

/** True when the currently-edited rule group allows repeated cells. */
function selectedGroupAllowsRepeats(): boolean {
	if (!ui.selectedRuleInstanceId) return false;
	const inst = puzzleStore.puzzle.localRules.find((r) => r.id === ui.selectedRuleInstanceId);
	if (!inst) return false;
	const cfg = getRuleById(inst.ruleId)?.config.groups?.[ui.selectedGroupIndex];
	return cfg?.allowRepeats === true;
}

/** True when the currently-edited rule group has a value field. */
function selectedGroupHasValue(): boolean {
	if (!ui.selectedRuleInstanceId) return false;
	const inst = puzzleStore.puzzle.localRules.find((r) => r.id === ui.selectedRuleInstanceId);
	if (!inst) return false;
	const cfg = getRuleById(inst.ruleId)?.config.groups?.[ui.selectedGroupIndex];
	return cfg?.hasValue === true;
}

// Track the boolean value being painted during a drag
let shadingDragValue: boolean | null = null;

// Node-based drag state for borders
// A "border node" is a grid corner at (row, col) where row=0..rows, col=0..cols
let lastBorderNode: { row: number; col: number } | null = null;
let borderDragValue: boolean | null = null; // null = not yet determined

// Node-based drag state for lines
// A "line node" is a cell center at (row, col) where row=0..rows-1, col=0..cols-1
let lastLineNode: { row: number; col: number } | null = null;

/**
 * Find the closest grid corner node (for border tool drag).
 * Nodes are at (r, c) where r=0..rows, c=0..cols.
 */
function closestBorderNode(
	x: number, y: number, layout: GridLayout, rows: number, cols: number
): { row: number; col: number } | null {
	const relX = x - layout.offsetX;
	const relY = y - layout.offsetY;
	const r = Math.round(relY / layout.cellSize);
	const c = Math.round(relX / layout.cellSize);
	if (r < 0 || r > rows || c < 0 || c > cols) return null;
	return { row: r, col: c };
}

/**
 * Find the closest cell center (for line tool drag).
 * Cell centers are at (r, c) where r=0..rows-1, c=0..cols-1.
 */
function closestLineNode(
	x: number, y: number, layout: GridLayout, rows: number, cols: number
): { row: number; col: number } | null {
	const relX = x - layout.offsetX;
	const relY = y - layout.offsetY;
	const r = Math.floor(relY / layout.cellSize);
	const c = Math.floor(relX / layout.cellSize);
	if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
	return { row: r, col: c };
}

/**
 * Given two adjacent border nodes, return the EdgeCoord between them.
 */
function borderNodesToEdge(
	a: { row: number; col: number },
	b: { row: number; col: number }
): EdgeCoord | null {
	const dr = b.row - a.row;
	const dc = b.col - a.col;
	if (dr === 0 && Math.abs(dc) === 1) {
		// Horizontal edge: h[row][min(col)]
		return { row: a.row, col: Math.min(a.col, b.col), direction: 'h' };
	}
	if (dc === 0 && Math.abs(dr) === 1) {
		// Vertical edge: v[min(row)][col]
		return { row: Math.min(a.row, b.row), col: a.col, direction: 'v' };
	}
	return null; // Not adjacent
}

/**
 * Given two adjacent line nodes (cell centers), return the EdgeCoord between them.
 */
function lineNodesToEdge(
	a: { row: number; col: number },
	b: { row: number; col: number }
): EdgeCoord | null {
	const dr = b.row - a.row;
	const dc = b.col - a.col;
	if (dr === 0 && Math.abs(dc) === 1) {
		// Cells side by side → vertical edge: v[row][max(col)]
		return { row: a.row, col: Math.max(a.col, b.col), direction: 'v' };
	}
	if (dc === 0 && Math.abs(dr) === 1) {
		// Cells above/below → horizontal edge: h[max(row)][col]
		return { row: Math.max(a.row, b.row), col: a.col, direction: 'h' };
	}
	return null; // Not adjacent
}

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

/**
 * Find the closest cell boundary edge (for border tool).
 * Borders lie on cell boundaries connecting corner nodes.
 * Includes outer grid boundaries.
 */
export function pixelToEdge(
	x: number,
	y: number,
	layout: GridLayout,
	rows: number,
	cols: number
): EdgeCoord | null {
	const { cellSize, offsetX, offsetY } = layout;
	const relX = x - offsetX;
	const relY = y - offsetY;
	const threshold = cellSize * 0.35;

	let bestDist = Infinity;
	let best: EdgeCoord | null = null;

	// Check horizontal edges: h[r][c] = edge going right from node (r,c)
	for (let r = 0; r <= rows; r++) {
		const edgeY = r * cellSize;
		const distY = Math.abs(relY - edgeY);
		if (distY > threshold) continue;
		const c = Math.floor(relX / cellSize);
		if (c < 0 || c >= cols) continue;
		const midX = (c + 0.5) * cellSize;
		const dist = Math.sqrt((relX - midX) ** 2 + distY ** 2);
		if (dist < bestDist) {
			bestDist = dist;
			best = { row: r, col: c, direction: 'h' };
		}
	}

	// Check vertical edges: v[r][c] = edge going down from node (r,c)
	for (let c = 0; c <= cols; c++) {
		const edgeX = c * cellSize;
		const distX = Math.abs(relX - edgeX);
		if (distX > threshold) continue;
		const r = Math.floor(relY / cellSize);
		if (r < 0 || r >= rows) continue;
		const midY = (r + 0.5) * cellSize;
		const dist = Math.sqrt(distX ** 2 + (relY - midY) ** 2);
		if (dist < bestDist) {
			bestDist = dist;
			best = { row: r, col: c, direction: 'v' };
		}
	}

	return best;
}

/**
 * Find the closest inter-cell connection (for line tool).
 * Lines connect adjacent cell centers, so only interior edges.
 */
export function pixelToLine(
	x: number,
	y: number,
	layout: GridLayout,
	rows: number,
	cols: number
): EdgeCoord | null {
	const { cellSize, offsetX, offsetY } = layout;
	const relX = x - offsetX;
	const relY = y - offsetY;
	const threshold = cellSize * 0.35;

	let bestDist = Infinity;
	let best: EdgeCoord | null = null;

	const cellCol = Math.floor(relX / cellSize);
	const cellRow = Math.floor(relY / cellSize);
	if (cellRow < 0 || cellRow >= rows || cellCol < 0 || cellCol >= cols) return null;

	const centerX = (cellCol + 0.5) * cellSize;
	const centerY = (cellRow + 0.5) * cellSize;

	const neighbors = [
		{ dr: 0, dc: 1 },  // right
		{ dr: 0, dc: -1 }, // left
		{ dr: 1, dc: 0 },  // down
		{ dr: -1, dc: 0 }, // up
	];

	for (const { dr, dc } of neighbors) {
		const nr = cellRow + dr;
		const nc = cellCol + dc;
		if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

		const neighborCenterX = (nc + 0.5) * cellSize;
		const neighborCenterY = (nr + 0.5) * cellSize;
		const midX = (centerX + neighborCenterX) / 2;
		const midY = (centerY + neighborCenterY) / 2;

		const dist = Math.sqrt((relX - midX) ** 2 + (relY - midY) ** 2);
		if (dist < threshold && dist < bestDist) {
			bestDist = dist;
			if (dc !== 0) {
				// Horizontal connection (cells side by side) → vertical edge
				best = { row: cellRow, col: Math.max(cellCol, nc), direction: 'v' };
			} else {
				// Vertical connection (cells above/below) → horizontal edge
				best = { row: Math.max(cellRow, nr), col: cellCol, direction: 'h' };
			}
		}
	}

	return best;
}

export function handleCanvasMouseDown(
	e: MouseEvent,
	layout: GridLayout
): void {
	const { rows, cols } = puzzleStore.puzzle.dimensions;
	const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;
	const mode = ui.mode;
	const tool = activeVar();

	// Region draw-edges mode: node-based drag identical to border tool but writes region edges
	if (mode === 'region-edit' && ui.regionDrawEdges) {
		const node = closestBorderNode(x, y, layout, rows, cols);
		if (!node) return;
		lastBorderNode = node;
		borderDragValue = null;
		selection.clearSelection();
		selection.startDrag();
		return;
	}

	// Border/line tools use node-based drag: mouseDown selects closest node,
	// mouseMove draws when a new neighboring node is reached.
	// Skip both when the user is editing a rule group — group cell assignment takes priority.
	const editingGroup = mode === 'setting' && !!ui.selectedRuleInstanceId && !selectedGroupIsCellless();

	if (!editingGroup && (mode === 'setting' || mode === 'solving') && tool?.kind === 'border') {
		const node = closestBorderNode(x, y, layout, rows, cols);
		if (!node) return;
		lastBorderNode = node;
		borderDragValue = null; // determined on first move
		selection.clearSelection();
		selection.startDrag();
		return;
	}

	if (!editingGroup && (mode === 'setting' || mode === 'solving') && tool?.kind === 'line') {
		const node = closestLineNode(x, y, layout, rows, cols);
		if (!node) return;
		lastLineNode = node;
		selection.clearSelection();
		selection.startDrag();
		return;
	}

	const cell = pixelToCell(x, y, layout, rows, cols);

	if (!cell) {
		selection.clearSelection();
		if (ui.selectedRuleInstanceId) {
			ui.selectRuleInstance(null);
		}
		return;
	}

	// Grid setup mode: no cell editing, only selection
	if (mode === 'grid-setup') {
		selection.selectCell(cell, e.shiftKey);
		selection.startDrag();
		return;
	}

	// Rule group editing takes priority over all other tools.
	// Cell-less groups (maxSize === 0) fall through to normal selection.
	if (mode === 'setting' && ui.selectedRuleInstanceId && !selectedGroupIsCellless()) {
		if (e.button !== 0) return; // right-click is handled by contextmenu handler
		if (selectedGroupIsRegion()) {
			// Region groups: one click selects the entire region the cell belongs to
			const regionId = puzzleStore.getCell(cell.row, cell.col).regionId;
			puzzleStore.setGroupToRegion(ui.selectedRuleInstanceId, ui.selectedGroupIndex, regionId);
		} else if (selectedGroupAllowsRepeats()) {
			// Repeating groups: left-click always appends (right-click removes last occurrence)
			puzzleStore.addCellToGroup(ui.selectedRuleInstanceId, ui.selectedGroupIndex, cell);
		} else {
			puzzleStore.toggleCellInGroup(ui.selectedRuleInstanceId, ui.selectedGroupIndex, cell);
		}
		return;
	}

	// In setting/solving mode with a boolean tool, cycle the value on click
	if ((mode === 'setting' || mode === 'solving') && tool?.kind === 'boolean') {
		const isGiven = mode === 'setting';
		const s = puzzleStore.getCellVar(tool.id, cell);
		if (!s) return;

		// In solving mode, don't modify givens
		if (mode === 'solving' && s.isGiven) return;

		// Determine what the click would set, then use that for the whole drag
		if (s.value === true) {
			shadingDragValue = false; // shaded -> unshaded
		} else if (s.value === false) {
			shadingDragValue = null; // unshaded -> clear
		} else {
			shadingDragValue = true; // clear -> shaded
		}

		puzzleStore.setCellVar(tool.id, cell, shadingDragValue, isGiven);
		selection.clearSelection();
		selection.startDrag();
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

	const mode = ui.mode;
	const tool = activeVar();

	// Region draw-edges drag: toggle interior edges and auto-renumber
	if (mode === 'region-edit' && ui.regionDrawEdges && lastBorderNode) {
		const node = closestBorderNode(x, y, layout, rows, cols);
		if (!node || (node.row === lastBorderNode.row && node.col === lastBorderNode.col)) return;
		const edge = borderNodesToEdge(lastBorderNode, node);
		if (!edge) { lastBorderNode = node; return; }

		// Only interior edges divide regions — skip outer boundary
		if (edge.direction === 'h' && (edge.row === 0 || edge.row === rows)) { lastBorderNode = node; return; }
		if (edge.direction === 'v' && (edge.col === 0 || edge.col === cols)) { lastBorderNode = node; return; }

		if (borderDragValue === null) {
			borderDragValue = puzzleStore.getRegionEdge(edge) ? null : true;
		}
		puzzleStore.setRegionEdge(edge, borderDragValue === true);
		puzzleStore.numberRegionsQuiet();
		lastBorderNode = node;
		return;
	}

	// Border drag: draw edge when moving to a new neighboring node
	if ((mode === 'setting' || mode === 'solving') && tool?.kind === 'border' && lastBorderNode) {
		const node = closestBorderNode(x, y, layout, rows, cols);
		if (!node || (node.row === lastBorderNode.row && node.col === lastBorderNode.col)) return;
		const edge = borderNodesToEdge(lastBorderNode, node);
		if (!edge) { lastBorderNode = node; return; } // not adjacent, update node but skip
		const s = puzzleStore.getEdgeVar(tool.id, edge);
		if (!s) { lastBorderNode = node; return; }
		const isGiven = mode === 'setting';
		if (mode === 'solving' && s.isGiven) { lastBorderNode = node; return; }
		// Determine drag mode on first edge drawn
		if (borderDragValue === null) {
			borderDragValue = s.value === true ? null : true;
		}
		puzzleStore.setEdgeVar(tool.id, edge, borderDragValue, isGiven);
		lastBorderNode = node;
		return;
	}

	// Line drag: increment edge when moving to a new neighboring cell center
	if ((mode === 'setting' || mode === 'solving') && tool?.kind === 'line' && lastLineNode) {
		const node = closestLineNode(x, y, layout, rows, cols);
		if (!node || (node.row === lastLineNode.row && node.col === lastLineNode.col)) return;
		const edge = lineNodesToEdge(lastLineNode, node);
		if (!edge) { lastLineNode = node; return; }
		const s = puzzleStore.getEdgeVar(tool.id, edge);
		if (!s) { lastLineNode = node; return; }
		const isGiven = mode === 'setting';
		if (mode === 'solving' && s.isGiven) { lastLineNode = node; return; }
		puzzleStore.incrementEdgeLines(tool.id, edge, isGiven);
		lastLineNode = node;
		return;
	}

	const cell = pixelToCell(x, y, layout, rows, cols);
	if (!cell) return;

	// Drag boolean painting — apply the same value determined on mousedown
	if ((mode === 'setting' || mode === 'solving') && tool?.kind === 'boolean') {
		const isGiven = mode === 'setting';
		const s = puzzleStore.getCellVar(tool.id, cell);
		if (!s) return;

		// In solving mode, don't modify givens
		if (mode === 'solving' && s.isGiven) return;

		// Only apply if the cell isn't already the target value
		if (s.value !== shadingDragValue) {
			puzzleStore.setCellVar(tool.id, cell, shadingDragValue, isGiven);
		}
		return;
	}

	// Drag selection
	selection.addCellToSelection(cell);
}

export function handleCanvasMouseUp(): void {
	selection.endDrag();
	shadingDragValue = null;
	lastBorderNode = null;
	borderDragValue = null;
	lastLineNode = null;
}

export function handleCanvasContextMenu(
	e: MouseEvent,
	layout: GridLayout
): void {
	const mode = ui.mode;
	const tool = activeVar();
	if (mode !== 'setting' && mode !== 'solving' && mode !== 'region-edit') return;

	const { rows, cols } = puzzleStore.puzzle.dimensions;
	const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;
	const isGiven = mode === 'setting';

	// allowRepeats group editing: right-click removes the last occurrence of a cell
	if (mode === 'setting' && ui.selectedRuleInstanceId && selectedGroupAllowsRepeats()) {
		const cell = pixelToCell(x, y, layout, rows, cols);
		if (cell) {
			e.preventDefault();
			puzzleStore.removeLastOccurrenceFromGroup(ui.selectedRuleInstanceId, ui.selectedGroupIndex, cell);
		}
		return;
	}

	// Region draw-edges: right-click toggles an edge
	if (mode === 'region-edit' && ui.regionDrawEdges) {
		const edge = pixelToEdge(x, y, layout, rows, cols);
		if (!edge) return;
		if (edge.direction === 'h' && (edge.row === 0 || edge.row === rows)) return;
		if (edge.direction === 'v' && (edge.col === 0 || edge.col === cols)) return;
		e.preventDefault();
		puzzleStore.setRegionEdge(edge, !puzzleStore.getRegionEdge(edge));
		puzzleStore.numberRegionsQuiet();
		return;
	}

	if (tool?.kind === 'border') {
		const edge = pixelToEdge(x, y, layout, rows, cols);
		if (!edge) return;
		const s = puzzleStore.getEdgeVar(tool.id, edge);
		if (!s) return;
		if (mode === 'solving' && s.isGiven) return;
		e.preventDefault();
		// Toggle: if already false (X), remove it; otherwise set to false
		puzzleStore.setEdgeVar(tool.id, edge, s.value === false ? null : false, isGiven);
	}

	if (tool?.kind === 'line') {
		const edge = pixelToLine(x, y, layout, rows, cols);
		if (!edge) return;
		const s = puzzleStore.getEdgeVar(tool.id, edge);
		if (!s) return;
		if (mode === 'solving' && s.isGiven) return;
		e.preventDefault();
		// Toggle: if already 0 (X), remove it; otherwise set to 0 (X)
		puzzleStore.setEdgeVar(tool.id, edge, s.value === 0 ? null : 0, isGiven);
	}
}

export function handleKeyDown(e: KeyboardEvent): void {
	// Don't handle keys when an overlay (e.g. custom rule editor) is open
	if (ui.customRuleEditorOpen) return;

	// Group value typing: when editing a group with a value field and a digit key is pressed
	// outside a focused input, accumulate keystrokes into the group value.
	// This runs BEFORE the "skip if input focused" guard so it handles the case where
	// the user clicked a cell (blurring the input) then types a new value.
	const activeEl = document.activeElement;
	const inputFocused = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;
	if (
		!inputFocused &&
		ui.selectedRuleInstanceId &&
		selectedGroupHasValue() &&
		e.key >= '0' && e.key <= '9' &&
		!e.ctrlKey && !e.metaKey && !e.altKey
	) {
		e.preventDefault();
		const now = Date.now();
		const buf = ui.groupValueBuffer;
		const isContinuation =
			buf !== null &&
			buf.instanceId === ui.selectedRuleInstanceId &&
			buf.groupIndex === ui.selectedGroupIndex &&
			now - buf.ts < 1500;
		const newStr = isContinuation ? buf.str + e.key : e.key;
		ui.groupValueBuffer = {
			instanceId: ui.selectedRuleInstanceId,
			groupIndex: ui.selectedGroupIndex,
			str: newStr,
			ts: now
		};
		puzzleStore.setGroupValue(ui.selectedRuleInstanceId, ui.selectedGroupIndex, parseInt(newStr));
		return;
	}

	// Don't steal keys from focused text inputs — let the user type in
	// search bars, name fields, etc. Cells remain selected.
	if (inputFocused) return;

	// Escape: deselect any selected rule/ruleset
	if (e.key === 'Escape') {
		ui.clearRuleSelection();
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
	const tool = activeVar();
	const cells = selection.cells;

	if (cells.length === 0) return;

	// Grid setup mode: only allow arrow navigation, no cell editing
	if (mode === 'grid-setup') {
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
		return;
	}

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
	if (!isNaN(num) && num >= 0 && num <= 9) {
		e.preventDefault();

		if (mode === 'region-edit') {
			if (!ui.regionDrawEdges) {
				for (const cell of cells) {
					puzzleStore.setRegionId(cell, num);
				}
			}
			return;
		}

		applyNumberInput(tool, cells, num, mode === 'setting', e.ctrlKey || e.metaKey);
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

/** Write a number value (or pencil mark) into the active number variable for the selection. */
export function applyNumberInput(
	tool: VariableInstance | null,
	cells: CellCoord[],
	num: number,
	isGiven: boolean,
	isPencilMark: boolean
): void {
	if (!tool || tool.kind !== 'number') return;
	const min = tool.min ?? 1;
	const max = tool.max ?? 9;
	if (num < min || num > max) return;

	for (const cell of cells) {
		const s = puzzleStore.getCellVar(tool.id, cell);
		if (!s) continue;
		// In solving mode, don't overwrite givens
		if (!isGiven && s.isGiven) continue;

		if (isPencilMark && !isGiven) {
			puzzleStore.toggleMark(tool.id, cell, num);
		} else {
			puzzleStore.setCellVar(tool.id, cell, num, isGiven);
		}
	}
}
