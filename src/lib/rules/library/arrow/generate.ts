import type { PuzzleState, RuleInstance } from '$lib/model/types';

/**
 * Arrow constraint generator.
 * Group 0 (bulb): cells read as a multi-digit base-10 number in selection order.
 * Group 1 (arrow): cells whose values sum to the bulb number.
 *
 * Emits: constraint <bulb_expression> = <arrow_sum>;
 */
export default function generate(_puzzle: PuzzleState, instance?: RuleInstance): string[] {
	if (!instance) return [];

	const bulb = instance.groups[0];
	const arrow = instance.groups[1];
	if (!bulb || !arrow || bulb.cells.length === 0 || arrow.cells.length === 0) return [];

	// Build bulb expression: read cells as a base-10 number
	// For cells [c1, c2, c3]: c1 * 100 + c2 * 10 + c3
	const bulbParts = bulb.cells.map((cell, i) => {
		const ref = `grid[${cell.row + 1},${cell.col + 1}]`;
		const power = bulb.cells.length - 1 - i;
		if (power === 0) return ref;
		if (power === 1) return `${ref} * 10`;
		return `${ref} * ${Math.pow(10, power)}`;
	});
	const bulbExpr = bulbParts.length === 1 ? bulbParts[0] : `(${bulbParts.join(' + ')})`;

	// Build arrow sum expression
	const arrowRefs = arrow.cells.map((cell) => `grid[${cell.row + 1},${cell.col + 1}]`);
	const arrowExpr = arrowRefs.length === 1 ? arrowRefs[0] : `(${arrowRefs.join(' + ')})`;

	return [`constraint ${bulbExpr} = ${arrowExpr};`];
}
