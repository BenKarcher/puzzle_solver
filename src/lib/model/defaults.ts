import type {
	CellValue,
	EdgeValue,
	PuzzleState,
	SolutionSpaces
} from './types';

export function createDefaultCell(regionId: number = 0): CellValue {
	return {
		number: null,
		numberIsGiven: false,
		shaded: null,
		shadedIsGiven: false,
		pencilMarks: [],
		regionId
	};
}

export function createDefaultEdge(): EdgeValue {
	return {
		border: null,
		borderIsGiven: false,
		lines: 0,
		lineIsGiven: false
	};
}

export function createDefaultSolutionSpaces(): SolutionSpaces {
	return {
		numbers: { enabled: true, min: 1, max: 9 },
		shading: { enabled: false },
		borders: { enabled: false },
		lines: { enabled: false, maxLinesPerPair: 1 }
	};
}

export function createCellGrid(rows: number, cols: number): CellValue[][] {
	return Array.from({ length: rows }, () =>
		Array.from({ length: cols }, () => createDefaultCell())
	);
}

export function createHEdgeGrid(rows: number, cols: number): EdgeValue[][] {
	// Horizontal edges: between row r and r+1, so (rows-1) rows of edges, cols columns
	return Array.from({ length: rows - 1 }, () =>
		Array.from({ length: cols }, () => createDefaultEdge())
	);
}

export function createVEdgeGrid(rows: number, cols: number): EdgeValue[][] {
	// Vertical edges: between col c and c+1, so rows rows, (cols-1) columns
	return Array.from({ length: rows }, () =>
		Array.from({ length: cols - 1 }, () => createDefaultEdge())
	);
}

export function createBlankPuzzle(rows: number = 9, cols: number = 9): PuzzleState {
	return {
		name: 'Untitled Puzzle',
		dimensions: { rows, cols },
		solutionSpaces: createDefaultSolutionSpaces(),
		cells: createCellGrid(rows, cols),
		hEdges: createHEdgeGrid(rows, cols),
		vEdges: createVEdgeGrid(rows, cols),
		globalRules: [],
		localRules: [],
		customRules: []
	};
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

	return {
		...puzzle,
		dimensions: { rows: newRows, cols: newCols },
		cells,
		hEdges: createHEdgeGrid(newRows, newCols),
		vEdges: createVEdgeGrid(newRows, newCols),
	};
}
