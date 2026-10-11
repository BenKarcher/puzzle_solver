import { nanoid } from 'nanoid';
import type { CellValue, PuzzleState, RegionLayout, VarKind, VariableInstance } from './types';
import { createVarGrid, defaultRender, kindLabel, resizeVarGrid } from './variables';

export function createDefaultCell(regionId: number = 0): CellValue {
	return { regionId };
}

/** Preset palette for variable colors (also shown in the setup color picker) */
export const VAR_COLOR_PALETTE = [
	'#646464', // grey (classic shading)
	'#3b82f6', // blue (classic lines/borders)
	'#d9480f', // orange
	'#2f9e44', // green
	'#9c36b5', // purple
	'#e8990c', // amber
	'#0ca678', // teal
	'#e64980', // pink
	'#5f3dc4', // indigo
	'#a0812c' // olive
] as const;

/** First palette color not already used by an existing variable */
export function pickDefaultColor(existing: VariableInstance[], kind: VarKind): string {
	const used = new Set(existing.map((v) => v.color).filter(Boolean));
	// Booleans start at grey (classic shading look), edge kinds at blue
	const start = kind === 'boolean' ? 0 : 1;
	for (let i = 0; i < VAR_COLOR_PALETTE.length; i++) {
		const c = VAR_COLOR_PALETTE[(start + i) % VAR_COLOR_PALETTE.length];
		if (!used.has(c)) return c;
	}
	return VAR_COLOR_PALETTE[start];
}

export function createVariableInstance(kind: VarKind, name?: string): VariableInstance {
	const v: VariableInstance = {
		id: nanoid(8),
		kind,
		name: name ?? kindLabel(kind),
		render: defaultRender(kind)
	};
	if (kind === 'number') {
		v.min = 1;
		v.max = 9;
	}
	if (kind === 'line') {
		v.maxLinesPerPair = 1;
	}
	return v;
}

export function createCellGrid(rows: number, cols: number): CellValue[][] {
	return Array.from({ length: rows }, () =>
		Array.from({ length: cols }, () => createDefaultCell())
	);
}

export function createRegionEdgeGrids(rows: number, cols: number): {
	regionEdgesH: boolean[][];
	regionEdgesV: boolean[][];
} {
	return {
		// Node-indexed like the old edge grids: h = (rows+1) × cols, v = rows × (cols+1)
		regionEdgesH: Array.from({ length: rows + 1 }, () => Array.from({ length: cols }, () => false)),
		regionEdgesV: Array.from({ length: rows }, () => Array.from({ length: cols + 1 }, () => false))
	};
}

export function createBlankPuzzle(rows: number = 9, cols: number = 9): PuzzleState {
	return {
		name: 'Untitled Puzzle',
		dimensions: { rows, cols },
		variables: [],
		varData: {},
		cells: createCellGrid(rows, cols),
		...createRegionEdgeGrids(rows, cols),
		manualGlobalRules: [],
		activeRulesets: [],
		globalRules: [],
		localRules: [],
		customRules: [],
		ruleBindingDefaults: {}
	};
}

/** Assign region ids according to a quickstart layout */
export function applyRegionLayout(
	puzzle: PuzzleState,
	layout: RegionLayout,
	boxRows: number = 3,
	boxCols: number = 3
): void {
	const { rows, cols } = puzzle.dimensions;
	const boxesPerRow = Math.ceil(cols / Math.max(1, boxCols));
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			let id = 0;
			if (layout === 'all') id = r * cols + c;
			else if (layout === 'rectangular')
				id = Math.floor(r / Math.max(1, boxRows)) * boxesPerRow + Math.floor(c / Math.max(1, boxCols));
			puzzle.cells[r][c].regionId = id;
		}
	}
}

/**
 * Resize a puzzle, preserving existing cell data where possible.
 */
export function resizePuzzle(puzzle: PuzzleState, newRows: number, newCols: number): PuzzleState {
	const cells: CellValue[][] = Array.from({ length: newRows }, (_, r) =>
		Array.from({ length: newCols }, (_, c) => {
			if (r < puzzle.dimensions.rows && c < puzzle.dimensions.cols) {
				return { ...puzzle.cells[r][c] };
			}
			return createDefaultCell();
		})
	);

	const varData: PuzzleState['varData'] = {};
	for (const v of puzzle.variables) {
		varData[v.id] = resizeVarGrid(
			v.kind,
			puzzle.varData[v.id] ?? createVarGrid(v.kind, newRows, newCols),
			newRows,
			newCols
		);
	}

	return {
		...puzzle,
		dimensions: { rows: newRows, cols: newCols },
		cells,
		varData,
		...createRegionEdgeGrids(newRows, newCols)
	};
}
