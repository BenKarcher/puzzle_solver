import type { PuzzleState } from '$lib/model/types';

/**
 * Combined negative constraint for kropki dots (consecutive + ratio).
 * For every pair of orthogonally adjacent cells that does NOT have a
 * consecutive-pairs or ratio-dot instance, emit:
 * constraint not (abs(a - b) = 1 \/ a = 2*b \/ b = 2*a);
 *
 * Note: this is different from separate negative-consecutive + negative-ratio
 * because the pair 1,2 satisfies BOTH consecutive and ratio. A combined negative
 * means unmarked pairs satisfy neither condition.
 */
export default function generate(puzzle: PuzzleState): string[] {
	const { rows, cols } = puzzle.dimensions;

	// Collect all cell pairs covered by consecutive-pairs or ratio-dot
	const covered = new Set<string>();
	for (const inst of puzzle.localRules) {
		if (inst.ruleId !== 'consecutive-pairs' && inst.ruleId !== 'ratio-dot') continue;
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
				const a = `grid[${r + 1},${c + 1}]`;
				const b = `grid[${r + 1},${c + 2}]`;
				lines.push(
					`constraint not (abs(${a} - ${b}) = 1 \\/ ${a} = 2*${b} \\/ ${b} = 2*${a});`
				);
			}
		}
	}

	// Check all vertical adjacent pairs
	for (let r = 0; r < rows - 1; r++) {
		for (let c = 0; c < cols; c++) {
			const key = `${r},${c}-${r + 1},${c}`;
			if (!covered.has(key)) {
				const a = `grid[${r + 1},${c + 1}]`;
				const b = `grid[${r + 2},${c + 1}]`;
				lines.push(
					`constraint not (abs(${a} - ${b}) = 1 \\/ ${a} = 2*${b} \\/ ${b} = 2*${a});`
				);
			}
		}
	}

	return lines;
}
