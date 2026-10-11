import type { GeneratorContext, PuzzleState } from '$lib/model/types';

/**
 * Negative constraint for consecutive (white) dots.
 * For every pair of orthogonally adjacent cells that does NOT have a
 * consecutive-pairs instance, emit: constraint abs(${arr}[r1,c1] - ${arr}[r2,c2]) != 1;
 */
export default function generate(puzzle: PuzzleState, ctx: GeneratorContext): string[] {
	const [arr] = ctx.bindings[0].arrays;
	const { rows, cols } = puzzle.dimensions;

	// Collect all cell pairs that have a consecutive-pairs dot
	const dotted = new Set<string>();
	for (const inst of puzzle.localRules) {
		if (inst.ruleId !== 'consecutive-pairs') continue;
		const group = inst.groups[0];
		if (!group || group.cells.length !== 2) continue;
		const [a, b] = group.cells;
		// Store both orderings so lookup is easy
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
					`constraint abs(${arr}[${r + 1},${c + 1}] - ${arr}[${r + 1},${c + 2}]) != 1;`
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
					`constraint abs(${arr}[${r + 1},${c + 1}] - ${arr}[${r + 2},${c + 1}]) != 1;`
				);
			}
		}
	}

	return lines;
}
