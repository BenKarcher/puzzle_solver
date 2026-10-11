import type {
	CellVarState,
	PuzzleState,
	RequiredSpace,
	ResolvedBinding,
	RuleConfig,
	VarGrid,
	VarKind,
	VariableInstance,
	WholeGridSpace
} from './types';

// ---- Kind ↔ space mapping ----

const SPACE_TO_KIND: Partial<Record<RequiredSpace | WholeGridSpace, VarKind>> = {
	digits: 'number',
	shading: 'boolean',
	borders: 'border',
	lines: 'line'
};

/** Variable kind a required space binds to, or null for non-bindable spaces (regions/positions/coordinates) */
export function kindOfSpace(space: RequiredSpace | WholeGridSpace): VarKind | null {
	return SPACE_TO_KIND[space] ?? null;
}

/**
 * The rule's bindable occurrences in canonical order:
 * wholeGrids entries first, then requiredSpaces bindable entries in declared order.
 */
export function bindableOccurrences(config: Pick<RuleConfig, 'requiredSpaces' | 'wholeGrids'>): VarKind[] {
	const kinds: VarKind[] = [];
	for (const s of config.wholeGrids ?? []) {
		const k = kindOfSpace(s);
		if (k) kinds.push(k);
	}
	for (const s of config.requiredSpaces) {
		const k = kindOfSpace(s);
		if (k) kinds.push(k);
	}
	return kinds;
}

/** First variable instance of a kind, if any */
export function firstOfKind(puzzle: PuzzleState, kind: VarKind): VariableInstance | undefined {
	return puzzle.variables.find((v) => v.kind === kind);
}

/** Default bindings for a rule: the first instance of each required kind */
export function defaultBindings(
	puzzle: PuzzleState,
	config: Pick<RuleConfig, 'requiredSpaces' | 'wholeGrids'>
): string[] {
	return bindableOccurrences(config).map((kind) => firstOfKind(puzzle, kind)?.id ?? '');
}

/**
 * Occurrence-wise validation of stored bindings: keep entries that reference an
 * existing instance of the right kind, fall back to the first instance otherwise.
 */
export function validatedBindings(
	puzzle: PuzzleState,
	config: Pick<RuleConfig, 'requiredSpaces' | 'wholeGrids'>,
	stored: string[] | undefined
): string[] {
	return bindableOccurrences(config).map((kind, i) => {
		const id = stored?.[i];
		if (id && puzzle.variables.some((v) => v.id === id && v.kind === kind)) return id;
		return firstOfKind(puzzle, kind)?.id ?? '';
	});
}

/**
 * Resolve an application's bindings to concrete instances, falling back to the
 * first instance of each kind for missing/stale entries. Returns null if any
 * occurrence cannot be satisfied.
 */
export function resolveBindings(
	puzzle: PuzzleState,
	config: Pick<RuleConfig, 'requiredSpaces' | 'wholeGrids'>,
	bindings: string[] | undefined
): VariableInstance[] | null {
	const kinds = bindableOccurrences(config);
	const resolved: VariableInstance[] = [];
	for (let i = 0; i < kinds.length; i++) {
		const bound = bindings?.[i]
			? puzzle.variables.find((v) => v.id === bindings[i] && v.kind === kinds[i])
			: undefined;
		const inst = bound ?? firstOfKind(puzzle, kinds[i]);
		if (!inst) return null;
		resolved.push(inst);
	}
	return resolved;
}

// ---- MZN naming ----

export interface MznNames {
	/** Array names for this instance: [name] for number/boolean, [h, v] for border/line */
	arrays: string[];
}

const KIND_BASE: Record<VarKind, string[]> = {
	number: ['digits'],
	boolean: ['shaded'],
	border: ['border_h', 'border_v'],
	line: ['line_h', 'line_v']
};

/**
 * MZN array names per instance. First instance of each kind keeps the canonical
 * names (digits, shaded, border_h/border_v, line_h/line_v); later instances get
 * _2, _3... suffixes (per-kind ordinal).
 */
export function mznNamesFor(puzzle: PuzzleState): Map<string, MznNames> {
	const ordinals = new Map<VarKind, number>();
	const result = new Map<string, MznNames>();
	for (const v of puzzle.variables) {
		const ord = (ordinals.get(v.kind) ?? 0) + 1;
		ordinals.set(v.kind, ord);
		const suffix = ord === 1 ? '' : `_${ord}`;
		result.set(v.id, { arrays: KIND_BASE[v.kind].map((b) => b + suffix) });
	}
	return result;
}

/** Resolve an application's bindings into ResolvedBinding objects (for generators/compiler) */
export function resolveBindingArrays(
	puzzle: PuzzleState,
	config: Pick<RuleConfig, 'requiredSpaces' | 'wholeGrids'>,
	bindings: string[] | undefined,
	names: Map<string, MznNames>
): ResolvedBinding[] | null {
	const instances = resolveBindings(puzzle, config, bindings);
	if (!instances) return null;
	return instances.map((inst) => ({
		kind: inst.kind,
		varId: inst.id,
		arrays: names.get(inst.id)?.arrays ?? []
	}));
}

// ---- Grid creation ----

export function createCellVarState(): CellVarState {
	return { value: null, isGiven: false, marks: [] };
}

function makeGrid(rows: number, cols: number): CellVarState[][] {
	return Array.from({ length: rows }, () =>
		Array.from({ length: cols }, () => createCellVarState())
	);
}

/** Create an empty value grid for a variable instance */
export function createVarGrid(kind: VarKind, rows: number, cols: number): VarGrid {
	if (kind === 'number' || kind === 'boolean') {
		return { cells: makeGrid(rows, cols) };
	}
	// border/line kinds: node-indexed edge grids (line kinds only use interior slots)
	return { h: makeGrid(rows + 1, cols), v: makeGrid(rows, cols + 1) };
}

/** Resize a value grid, preserving existing data where positions overlap */
export function resizeVarGrid(
	kind: VarKind,
	grid: VarGrid,
	rows: number,
	cols: number
): VarGrid {
	const copy = (
		src: CellVarState[][] | undefined,
		nRows: number,
		nCols: number
	): CellVarState[][] =>
		Array.from({ length: nRows }, (_, r) =>
			Array.from({ length: nCols }, (_, c) =>
				src?.[r]?.[c] ? { ...src[r][c], marks: [...src[r][c].marks] } : createCellVarState()
			)
		);
	if (kind === 'number' || kind === 'boolean') {
		return { cells: copy(grid.cells, rows, cols) };
	}
	return { h: copy(grid.h, rows + 1, cols), v: copy(grid.v, rows, cols + 1) };
}

// ---- Domain / defaults ----

/** All possible values for an instance (numbers: min..max; booleans: true/false; lines: 0..max) */
export function instanceDomain(v: VariableInstance): (number | boolean)[] {
	if (v.kind === 'number') {
		const out: number[] = [];
		for (let i = v.min ?? 1; i <= (v.max ?? 9); i++) out.push(i);
		return out;
	}
	if (v.kind === 'line') {
		const out: number[] = [];
		for (let i = 0; i <= (v.maxLinesPerPair ?? 1); i++) out.push(i);
		return out;
	}
	return [true, false];
}

/** Effective compile-time default for a constant instance */
export function constantDefault(v: VariableInstance): number | boolean {
	if (v.defaultValue !== undefined) return v.defaultValue;
	if (v.kind === 'number') return v.min ?? 1;
	if (v.kind === 'line') return 0;
	return false;
}

/** Display label fallback */
export function kindLabel(kind: VarKind): string {
	switch (kind) {
		case 'number': return 'Numbers';
		case 'boolean': return 'Boolean';
		case 'border': return 'Borders';
		case 'line': return 'Lines';
	}
}

/** Default render mode for a kind */
export function defaultRender(kind: VarKind): VariableInstance['render'] {
	switch (kind) {
		case 'number': return 'digits';
		case 'boolean': return 'shading';
		case 'border': return 'lines';
		case 'line': return 'lines';
	}
}
