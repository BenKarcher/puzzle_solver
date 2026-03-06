import type { PuzzleState } from '$lib/model/types';

/**
 * Disjoint groups constraint.
 * Groups cells by their region, sorts each region's cells in row-major order,
 * then for each position index, collects the cell at that index from every region
 * and emits an alldifferent constraint.
 */
export default function generate(puzzle: PuzzleState): string[] {
	const { rows, cols } = puzzle.dimensions;

	// Group cells by regionId
	const regions = new Map<number, { row: number; col: number }[]>();
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const regionId = puzzle.cells[r][c].regionId;
			if (regionId == null || regionId === 0) continue;
			if (!regions.has(regionId)) {
				regions.set(regionId, []);
			}
			regions.get(regionId)!.push({ row: r, col: c });
		}
	}

	// Need at least 2 regions for the constraint to be meaningful
	if (regions.size < 2) return [];

	// Sort cells within each region by row then column (row-major order)
	for (const cells of regions.values()) {
		cells.sort((a, b) => a.row - b.row || a.col - b.col);
	}

	// Find the maximum region size (all regions should be the same size for standard sudoku)
	const regionArrays = Array.from(regions.values());
	const maxSize = Math.max(...regionArrays.map((r) => r.length));

	const lines: string[] = ['include "alldifferent.mzn";'];

	// For each position index, collect the cell at that index from every region
	for (let i = 0; i < maxSize; i++) {
		const cellRefs: string[] = [];
		for (const cells of regionArrays) {
			if (i < cells.length) {
				const cell = cells[i];
				cellRefs.push(`grid[${cell.row + 1}, ${cell.col + 1}]`);
			}
		}
		// Need at least 2 cells to form a meaningful alldifferent
		if (cellRefs.length >= 2) {
			lines.push(`constraint alldifferent([${cellRefs.join(', ')}]);`);
		}
	}

	return lines;
}
