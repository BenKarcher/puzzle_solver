import type { PuzzleState } from '$lib/model/types';

/**
 * Negative constraint for XV clues.
 * For every pair of orthogonally adjacent cells that does NOT have an
 * x-sum-10 or v-sum-5 instance, emit constraints that they cannot sum to 10 or 5.
 */
export default function generate(puzzle: PuzzleState): string[] {
	const { rows, cols } = puzzle.dimensions;

	// Collect all cell pairs covered by x-sum-10 or v-sum-5
	const covered = new Set<string>();
	for (const inst of puzzle.localRules) {
		if (inst.ruleId !== 'x-sum-10' && inst.ruleId !== 'v-sum-5') continue;
		const group = inst.groups[0];
		if (!group || group.cells.length !== 2) continue;
		const [a, b] = group.cells;
		covered.add(`${a.row},${a.col}-${b.row},${b.col}`);
		covered.add(`${b.row},${b.col}-${a.row},${a.col}`);
	}

	const lines: string[] = [];

	// Check all horizontal adjacent pairs
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols - 1; c++) {
			const key = `${r},${c}-${r},${c + 1}`;
			if (!covered.has(key)) {
				lines.push(
					`constraint grid[${r + 1},${c + 1}] + grid[${r + 1},${c + 2}] != 10;`
				);
				lines.push(
					`constraint grid[${r + 1},${c + 1}] + grid[${r + 1},${c + 2}] != 5;`
				);
			}
		}
	}

	// Check all vertical adjacent pairs
	for (let r = 0; r < rows - 1; r++) {
		for (let c = 0; c < cols; c++) {
			const key = `${r},${c}-${r + 1},${c}`;
			if (!covered.has(key)) {
				lines.push(
					`constraint grid[${r + 1},${c + 1}] + grid[${r + 2},${c + 1}] != 10;`
				);
				lines.push(
					`constraint grid[${r + 1},${c + 1}] + grid[${r + 2},${c + 1}] != 5;`
				);
			}
		}
	}

	return lines;
}
