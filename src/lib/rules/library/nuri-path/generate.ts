import type { PuzzleState } from '$lib/model/types';

export default function generate(puzzle: PuzzleState): string[] {
	const { rows, cols } = puzzle.dimensions;

	// Collect every cell belonging to a nuri-sg group (S and G cells).
	// Those cells have degree exactly 1 (enforced by the nuri-sg local predicate)
	// and must NOT receive the 0-or-2 constraint.
	const sgCells = new Set<string>();
	for (const inst of puzzle.localRules) {
		if (inst.ruleId !== 'nuri-sg') continue;
		for (const group of inst.groups) {
			for (const cell of group.cells) {
				sgCells.add(`${cell.row},${cell.col}`);
			}
		}
	}

	const constraints: string[] = [];
	for (let r = 1; r <= rows; r++) {
		for (let c = 1; c <= cols; c++) {
			if (!sgCells.has(`${r - 1},${c - 1}`)) {
				constraints.push(
					`constraint cell_line_count(${r}, ${c}) = 0 \\/ cell_line_count(${r}, ${c}) = 2;`
				);
			}
		}
	}
	return constraints;
}
