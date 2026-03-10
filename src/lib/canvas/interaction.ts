import type { CellCoord, EdgeCoord, AppMode, ActiveTool } from '$lib/model/types';
import type { GridLayout } from './GridRenderer';
import { puzzleStore } from '$lib/state/puzzle.svelte';
import { selection } from '$lib/state/selection.svelte';
import { ui } from '$lib/state/ui.svelte';

// Track the shading value being painted during a drag
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
		// Horizontal edge: hEdges[row][min(col)]
		return { row: a.row, col: Math.min(a.col, b.col), direction: 'h' };
	}
	if (dc === 0 && Math.abs(dr) === 1) {
		// Vertical edge: vEdges[min(row)][col]
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
		// Cells side by side → vertical edge: vEdges[row][max(col)]
		return { row: a.row, col: Math.max(a.col, b.col), direction: 'v' };
	}
	if (dc === 0 && Math.abs(dr) === 1) {
		// Cells above/below → horizontal edge: hEdges[max(row)][col]
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

	// Check horizontal edges: hEdges[r][c] = edge going right from node (r,c)
	// Nodes are at row boundaries: r = 0..rows, edge goes from x=c*cellSize to x=(c+1)*cellSize at y=r*cellSize
	for (let r = 0; r <= rows; r++) {
		const edgeY = r * cellSize;
		const distY = Math.abs(relY - edgeY);
		if (distY > threshold) continue;
		// Which column segment?
		const c = Math.floor(relX / cellSize);
		if (c < 0 || c >= cols) continue;
		// Distance to the edge segment midpoint
		const midX = (c + 0.5) * cellSize;
		const dist = Math.sqrt((relX - midX) ** 2 + distY ** 2);
		if (dist < bestDist) {
			bestDist = dist;
			best = { row: r, col: c, direction: 'h' };
		}
	}

	// Check vertical edges: vEdges[r][c] = edge going down from node (r,c)
	// Nodes are at column boundaries: c = 0..cols, edge goes from y=r*cellSize to y=(r+1)*cellSize at x=c*cellSize
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

	// Find which cell the point is in
	const cellCol = Math.floor(relX / cellSize);
	const cellRow = Math.floor(relY / cellSize);
	if (cellRow < 0 || cellRow >= rows || cellCol < 0 || cellCol >= cols) return null;

	const centerX = (cellCol + 0.5) * cellSize;
	const centerY = (cellRow + 0.5) * cellSize;

	// Check connections to adjacent cells
	// Right neighbor: line between (cellRow, cellCol) and (cellRow, cellCol+1)
	// This corresponds to vEdges[cellRow][cellCol+1] (but line arrays are interior only)
	// Check 4 neighbors — map to edge storage:
	// Cells side by side (dc≠0): boundary at vEdges[row][max(col,nc)]
	// Cells above/below (dr≠0): boundary at hEdges[max(row,nr)][col]
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
				const edgeCol = Math.max(cellCol, nc); // the node column between them
				best = { row: cellRow, col: edgeCol, direction: 'v' };
			} else {
				// Vertical connection (cells above/below) → horizontal edge
				const edgeRow = Math.max(cellRow, nr); // the node row between them
				best = { row: edgeRow, col: cellCol, direction: 'h' };
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
	const tool = ui.activeTool;

	// Border/line tools use node-based drag: mouseDown selects closest node,
	// mouseMove draws when a new neighboring node is reached
	if ((mode === 'setting' || mode === 'solving') && tool === 'border') {
		const node = closestBorderNode(x, y, layout, rows, cols);
		if (!node) return;
		lastBorderNode = node;
		borderDragValue = null; // determined on first move
		selection.clearSelection();
		selection.startDrag();
		return;
	}

	if ((mode === 'setting' || mode === 'solving') && tool === 'line') {
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

	// Rule group editing takes priority over all other tools
	if (mode === 'setting' && ui.selectedRuleInstanceId) {
		puzzleStore.toggleCellInGroup(ui.selectedRuleInstanceId, ui.selectedGroupIndex, cell);
		return;
	}

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
	const tool = ui.activeTool;

	// Border drag: draw edge when moving to a new neighboring node
	if ((mode === 'setting' || mode === 'solving') && tool === 'border' && lastBorderNode) {
		const node = closestBorderNode(x, y, layout, rows, cols);
		if (!node || (node.row === lastBorderNode.row && node.col === lastBorderNode.col)) return;
		const edge = borderNodesToEdge(lastBorderNode, node);
		if (!edge) { lastBorderNode = node; return; } // not adjacent, update node but skip
		const currentEdge = puzzleStore.getEdge(edge);
		if (!currentEdge) { lastBorderNode = node; return; }
		const isGiven = mode === 'setting';
		if (mode === 'solving' && currentEdge.borderIsGiven) { lastBorderNode = node; return; }
		// Determine drag mode on first edge drawn
		if (borderDragValue === null) {
			borderDragValue = currentEdge.border === true ? null : true;
		}
		puzzleStore.setEdgeBorder(edge, borderDragValue, isGiven);
		lastBorderNode = node;
		return;
	}

	// Line drag: increment edge when moving to a new neighboring cell center
	if ((mode === 'setting' || mode === 'solving') && tool === 'line' && lastLineNode) {
		const node = closestLineNode(x, y, layout, rows, cols);
		if (!node || (node.row === lastLineNode.row && node.col === lastLineNode.col)) return;
		const edge = lineNodesToEdge(lastLineNode, node);
		if (!edge) { lastLineNode = node; return; }
		const currentEdge = puzzleStore.getEdge(edge);
		if (!currentEdge) { lastLineNode = node; return; }
		const isGiven = mode === 'setting';
		if (mode === 'solving' && currentEdge.lineIsGiven) { lastLineNode = node; return; }
		const maxLines = puzzleStore.puzzle.solutionSpaces.lines.maxLinesPerPair;
		puzzleStore.incrementEdgeLines(edge, maxLines, isGiven);
		lastLineNode = node;
		return;
	}

	const cell = pixelToCell(x, y, layout, rows, cols);
	if (!cell) return;

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
	lastBorderNode = null;
	borderDragValue = null;
	lastLineNode = null;
}

export function handleCanvasContextMenu(
	e: MouseEvent,
	layout: GridLayout
): void {
	const mode = ui.mode;
	const tool = ui.activeTool;
	if (mode !== 'setting' && mode !== 'solving') return;

	const { rows, cols } = puzzleStore.puzzle.dimensions;
	const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;
	const isGiven = mode === 'setting';

	if (tool === 'border') {
		const edge = pixelToEdge(x, y, layout, rows, cols);
		if (!edge) return;
		const currentEdge = puzzleStore.getEdge(edge);
		if (!currentEdge) return;
		if (mode === 'solving' && currentEdge.borderIsGiven) return;
		e.preventDefault();
		// Toggle: if already false (X), remove it; otherwise set to false
		puzzleStore.setEdgeBorder(edge, currentEdge.border === false ? null : false, isGiven);
	}

	if (tool === 'line') {
		const edge = pixelToLine(x, y, layout, rows, cols);
		if (!edge) return;
		const currentEdge = puzzleStore.getEdge(edge);
		if (!currentEdge) return;
		if (mode === 'solving' && currentEdge.lineIsGiven) return;
		e.preventDefault();
		// Toggle: if already 0 (X), remove it; otherwise set to 0 (X)
		puzzleStore.setEdgeLines(edge, currentEdge.lines === 0 ? null : 0, isGiven);
	}
}

export function handleKeyDown(e: KeyboardEvent): void {
	// Don't handle keys when an overlay (e.g. custom rule editor) is open
	if (ui.customRuleEditorOpen) return;

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
