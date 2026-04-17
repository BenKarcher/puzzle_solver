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
		lines: null,
		lineIsGiven: false,
		linePencilMarks: []
	};
}

export function createDefaultSolutionSpaces(): SolutionSpaces {
	return {
		numbers: { enabled: true, min: 1, max: 9 },
		modifiers: { enabled: false, min: 1, max: 18 },
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
	// Horizontal edges indexed by node: (rows+1) node rows, cols edges per row
	// hEdges[r][c] = horizontal edge going right from node (r,c)
	return Array.from({ length: rows + 1 }, () =>
		Array.from({ length: cols }, () => createDefaultEdge())
	);
}

export function createVEdgeGrid(rows: number, cols: number): EdgeValue[][] {
	// Vertical edges indexed by node: rows node rows, (cols+1) edges per row
	// vEdges[r][c] = vertical edge going down from node (r,c)
	return Array.from({ length: rows }, () =>
		Array.from({ length: cols + 1 }, () => createDefaultEdge())
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

	const hEdges: EdgeValue[][] = Array.from({ length: newRows + 1 }, (_, r) =>
		Array.from({ length: newCols }, (_, c) => {
			if (r < puzzle.hEdges.length && c < (puzzle.hEdges[r]?.length ?? 0)) {
				return { ...puzzle.hEdges[r][c] };
			}
			return createDefaultEdge();
		})
	);

	const vEdges: EdgeValue[][] = Array.from({ length: newRows }, (_, r) =>
		Array.from({ length: newCols + 1 }, (_, c) => {
			if (r < puzzle.vEdges.length && c < (puzzle.vEdges[r]?.length ?? 0)) {
				return { ...puzzle.vEdges[r][c] };
			}
			return createDefaultEdge();
		})
	);

	return {
		...puzzle,
		dimensions: { rows: newRows, cols: newCols },
		cells,
		hEdges,
		vEdges,
	};
}
