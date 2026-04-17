import type { PuzzleState, RuleInstance } from '$lib/model/types';

/**
 * Palindrome constraint generator.
 * Cells on the line read the same forwards and backwards.
 * For cells [c1, c2, ..., cn]: c1=cn, c2=cn-1, etc.
 */
export default function generate(_puzzle: PuzzleState, instance?: RuleInstance): string[] {
	if (!instance) return [];

	const group = instance.groups[0];
	if (!group || group.cells.length < 2) return [];

	const cells = group.cells;
	const n = cells.length;
	const constraints: string[] = [];

	for (let i = 0; i < Math.floor(n / 2); i++) {
		const left = cells[i];
		const right = cells[n - 1 - i];
		constraints.push(
			`constraint digits[${left.row + 1},${left.col + 1}] = digits[${right.row + 1},${right.col + 1}];`
		);
	}

	return constraints;
}
