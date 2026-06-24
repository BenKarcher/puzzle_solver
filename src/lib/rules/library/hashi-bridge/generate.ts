import type { PuzzleState } from '$lib/model/types';

/**
 * Emit hashi_bridge_cell(r, c) for every cell that is NOT covered by a
 * hashi-island instance. Island cells are constrained by their own clue;
 * bridge cells must carry lines straight through (or have no lines at all).
 */
export default function generate(puzzle: PuzzleState): string[] {
	const { rows, cols } = puzzle.dimensions;

	// Collect every cell that belongs to at least one hashi-island group
	const islandCells = new Set<string>();
	for (const inst of puzzle.localRules) {
		if (inst.ruleId !== 'hashi-island') continue;
		for (const group of inst.groups) {
			for (const cell of group.cells) {
				islandCells.add(`${cell.row},${cell.col}`);
			}
		}
	}

	const lines: string[] = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			if (!islandCells.has(`${r},${c}`)) {
				lines.push(`constraint hashi_bridge_cell(${r + 1}, ${c + 1});`);
			}
		}
	}
	return lines;
}
