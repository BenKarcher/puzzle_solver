import type { GeneratorContext, PuzzleState } from '$lib/model/types';

/**
 * Negative constraint for ratio (black) dots.
 * For every pair of orthogonally adjacent cells that does NOT have a
 * ratio-dot instance, emit: constraint not (${arr}[r1,c1] = 2*${arr}[r2,c2] \/ ${arr}[r2,c2] = 2*${arr}[r1,c1]);
 */
export default function generate(puzzle: PuzzleState, ctx: GeneratorContext): string[] {
	const [arr] = ctx.bindings[0].arrays;
	const { rows, cols } = puzzle.dimensions;

	// Collect all cell pairs that have a ratio-dot
	const dotted = new Set<string>();
	for (const inst of puzzle.localRules) {
		if (inst.ruleId !== 'ratio-dot') continue;
		const group = inst.groups[0];
		if (!group || group.cells.length !== 2) continue;
		const [a, b] = group.cells;
		dotted.add(`${a.row},${a.col}-${b.row},${b.col}`);
		dotted.add(`${b.row},${b.col}-${a.row},${a.col}`);
	}

	const lines: string[] = [];

	// Check all horizontal adjacent pairs
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols - 1; c++) {
			const key = `${r},${c}-${r},${c + 1}`;
			if (!dotted.has(key)) {
				lines.push(
					`constraint not (${arr}[${r + 1},${c + 1}] = 2*${arr}[${r + 1},${c + 2}] \\/ ${arr}[${r + 1},${c + 2}] = 2*${arr}[${r + 1},${c + 1}]);`
				);
			}
		}
	}

	// Check all vertical adjacent pairs
	for (let r = 0; r < rows - 1; r++) {
		for (let c = 0; c < cols; c++) {
			const key = `${r},${c}-${r + 1},${c}`;
			if (!dotted.has(key)) {
				lines.push(
					`constraint not (${arr}[${r + 1},${c + 1}] = 2*${arr}[${r + 2},${c + 1}] \\/ ${arr}[${r + 2},${c + 1}] = 2*${arr}[${r + 1},${c + 1}]);`
				);
			}
		}
	}

	return lines;
}
