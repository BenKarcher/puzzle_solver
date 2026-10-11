import type {
	PuzzleState,
	RegionLayout,
	RulesetConfig,
	RulesetRuleEntry,
	RulesetVariable,
	VarKind
} from '$lib/model/types';
import { bindableOccurrences, firstOfKind, kindOfSpace, kindLabel } from '$lib/model/variables';
import { getRuleById } from './registry';

export interface RulesetSlot {
	name: string;
	kind: VarKind;
	/** The full config annotation when the slot was declared explicitly (quickstart defaults) */
	spec?: RulesetVariable;
}

export function entryId(entry: RulesetRuleEntry): string {
	return typeof entry === 'string' ? entry : entry.id;
}

export function rulesetRuleIds(rs: RulesetConfig): string[] {
	return rs.rules.map(entryId);
}

/**
 * The variable slots a ruleset exposes. Explicit `variables` from the config,
 * or inferred as one slot per kind used by the member rules (first-appearance order).
 */
export function rulesetSlots(rs: RulesetConfig): RulesetSlot[] {
	if (rs.variables?.length) {
		const slots: RulesetSlot[] = [];
		for (const v of rs.variables) {
			const kind = kindOfSpace(v.kind);
			if (kind) slots.push({ name: v.name, kind, spec: v });
		}
		return slots;
	}
	const slots: RulesetSlot[] = [];
	for (const entry of rs.rules) {
		const rule = getRuleById(entryId(entry));
		if (!rule) continue;
		for (const kind of bindableOccurrences(rule.config)) {
			if (!slots.some((s) => s.kind === kind)) {
				slots.push({ name: kindLabel(kind), kind });
			}
		}
	}
	return slots;
}

/** Largest factor of n that is ≤ √n */
export function boxHeightFor(n: number): number {
	let best = 1;
	for (let f = 1; f * f <= n; f++) {
		if (n % f === 0) best = f;
	}
	return best;
}

/** Smallest factor of n that is ≥ √n */
export function boxWidthFor(n: number): number {
	return n / boxHeightFor(n);
}

/** Quickstart defaults with fallbacks applied */
export function rulesetDefaults(rs: RulesetConfig): {
	rows: number;
	cols: number;
	regions: RegionLayout;
	boxRows: number;
	boxCols: number;
} {
	const d = rs.defaults ?? {};
	const rows = d.rows ?? 9;
	const cols = d.cols ?? 9;
	// Rectangular fallback: box height = largest factor of rows ≤ √rows,
	// box width = smallest factor of cols ≥ √cols (e.g. 6×6 → 2×3 boxes, 9×9 → 3×3)
	const boxRows = d.boxRows ?? boxHeightFor(rows);
	const boxCols = d.boxCols ?? boxWidthFor(cols);
	return { rows, cols, regions: d.regions ?? 'none', boxRows, boxCols };
}

/** Default slot bindings: the first variable instance of each slot's kind */
export function defaultRulesetBindings(puzzle: PuzzleState, rs: RulesetConfig): string[] {
	return rulesetSlots(rs).map((slot) => firstOfKind(puzzle, slot.kind)?.id ?? '');
}

/**
 * Resolve one member rule's bindings from the set's slot bindings.
 * Occurrence i uses the entry's explicit slot index when given, otherwise the
 * first slot of the occurrence's kind.
 */
export function memberRuleBindings(
	rs: RulesetConfig,
	entry: RulesetRuleEntry,
	slotBindings: string[]
): string[] {
	const rule = getRuleById(entryId(entry));
	if (!rule) return [];
	const slots = rulesetSlots(rs);
	const explicit = typeof entry === 'string' ? undefined : entry.bindings;
	return bindableOccurrences(rule.config).map((kind, i) => {
		const slotIdx = explicit?.[i] ?? slots.findIndex((s) => s.kind === kind);
		return slotBindings[slotIdx] ?? '';
	});
}
