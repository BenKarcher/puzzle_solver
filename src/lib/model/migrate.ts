import { nanoid } from 'nanoid';
import type {
	CustomRuleDefinition,
	GlobalRuleApplication,
	PuzzleState,
	RuleInstance,
	VariableInstance
} from './types';
import { createCellGrid, createRegionEdgeGrids, createVariableInstance } from './defaults';
import { createVarGrid } from './variables';
import { getRuleById, getRulesetById } from '$lib/rules/registry';
import { defaultRulesetBindings, entryId, memberRuleBindings } from '$lib/rules/rulesets';
import type { RulesetActivation } from './types';

function bindingsSig(bindings: string[] | undefined): string {
	return (bindings ?? []).join(',');
}

/**
 * Recompute state.globalRules = manual applications ∪ slot-bound ruleset rules.
 * Shared by the puzzle store (on every rule/ruleset/variable change) and by save loading.
 */
export function syncEffectiveGlobalRules(state: PuzzleState): void {
	const manual = state.manualGlobalRules;
	const manualSigs = new Set(manual.map((a) => `${a.ruleId}|${bindingsSig(a.bindings)}`));
	const fromRulesets: GlobalRuleApplication[] = [];
	for (const activation of state.activeRulesets) {
		const rs = getRulesetById(activation.rulesetId);
		if (!rs) continue;
		const slotBindings = activation.bindings?.length
			? activation.bindings
			: defaultRulesetBindings(state, rs);
		for (const entry of rs.rules) {
			const ruleId = entryId(entry);
			const rule = getRuleById(ruleId);
			if (!rule || rule.config.scope !== 'global') continue;
			const bindings = memberRuleBindings(rs, entry, slotBindings);
			const sig = `${ruleId}|${bindingsSig(bindings)}`;
			if (manualSigs.has(sig)) continue;
			if (fromRulesets.some((a) => `${a.ruleId}|${bindingsSig(a.bindings)}` === sig)) continue;
			fromRulesets.push({ key: `rs:${activation.rulesetId}:${ruleId}`, ruleId, bindings });
		}
	}
	state.globalRules = [...manual, ...fromRulesets];
}

/** Accept ruleset ids (legacy) or activation objects, producing valid activations */
function normalizeActivations(list: unknown): RulesetActivation[] {
	if (!Array.isArray(list)) return [];
	return list.map((entry) => {
		if (typeof entry === 'string') {
			return { rulesetId: entry, bindings: [] };
		}
		const a = entry as RulesetActivation;
		return { rulesetId: a.rulesetId, bindings: a.bindings ?? [] };
	});
}


interface LegacyCell {
	number?: number | null;
	numberIsGiven?: boolean;
	shaded?: boolean | null;
	shadedIsGiven?: boolean;
	pencilMarks?: number[];
	regionId?: number;
}

interface LegacyEdge {
	border?: boolean | null;
	borderIsGiven?: boolean;
	lines?: number | null;
	lineIsGiven?: boolean;
	linePencilMarks?: number[];
}

/**
 * Accept both current-format saves and legacy (solutionSpaces-era) saves,
 * returning a valid current-format PuzzleState.
 */
export function migratePuzzleJSON(raw: Record<string, unknown>): PuzzleState {
	// Current format: has `variables` array
	if (Array.isArray(raw.variables)) {
		const state = raw as unknown as PuzzleState;
		if (!state.customRules) state.customRules = [];
		state.activeRulesets = normalizeActivations(state.activeRulesets);
		if (!state.ruleBindingDefaults) state.ruleBindingDefaults = {};
		if (!state.varData) state.varData = {};
		if (!state.regionEdgesH || !state.regionEdgesV) {
			Object.assign(state, createRegionEdgeGrids(state.dimensions.rows, state.dimensions.cols));
		}
		for (const inst of state.localRules ?? []) {
			if (!inst.bindings) inst.bindings = [];
		}
		state.manualGlobalRules = normalizeApplications(state.manualGlobalRules);
		syncEffectiveGlobalRules(state);
		return state;
	}

	// ---- Legacy format ----
	const dims = raw.dimensions as { rows: number; cols: number };
	const { rows, cols } = dims;
	const legacySpaces = (raw.solutionSpaces ?? {}) as Record<
		string,
		{ enabled?: boolean; min?: number; max?: number; maxLinesPerPair?: number }
	>;
	const legacyCells = (raw.cells ?? []) as LegacyCell[][];
	const legacyH = (raw.hEdges ?? []) as LegacyEdge[][];
	const legacyV = (raw.vEdges ?? []) as LegacyEdge[][];

	const variables: VariableInstance[] = [];
	const varData: PuzzleState['varData'] = {};

	if (legacySpaces.numbers?.enabled) {
		const v = createVariableInstance('number');
		v.min = legacySpaces.numbers.min ?? 1;
		v.max = legacySpaces.numbers.max ?? 9;
		variables.push(v);
		const grid = createVarGrid('number', rows, cols);
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const lc = legacyCells[r]?.[c];
				const s = grid.cells![r][c];
				s.value = lc?.number ?? null;
				s.isGiven = lc?.numberIsGiven ?? false;
				s.marks = lc?.pencilMarks ? [...lc.pencilMarks] : [];
			}
		}
		varData[v.id] = grid;
	}

	if (legacySpaces.shading?.enabled) {
		const v = createVariableInstance('boolean', 'Shading');
		variables.push(v);
		const grid = createVarGrid('boolean', rows, cols);
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const lc = legacyCells[r]?.[c];
				const s = grid.cells![r][c];
				s.value = lc?.shaded ?? null;
				s.isGiven = lc?.shadedIsGiven ?? false;
			}
		}
		varData[v.id] = grid;
	}

	if (legacySpaces.borders?.enabled) {
		const v = createVariableInstance('border');
		variables.push(v);
		const grid = createVarGrid('border', rows, cols);
		for (let r = 0; r <= rows; r++) {
			for (let c = 0; c < cols; c++) {
				const le = legacyH[r]?.[c];
				const s = grid.h![r][c];
				s.value = le?.border ?? null;
				s.isGiven = le?.borderIsGiven ?? false;
			}
		}
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c <= cols; c++) {
				const le = legacyV[r]?.[c];
				const s = grid.v![r][c];
				s.value = le?.border ?? null;
				s.isGiven = le?.borderIsGiven ?? false;
			}
		}
		varData[v.id] = grid;
	}

	if (legacySpaces.lines?.enabled) {
		const v = createVariableInstance('line');
		v.maxLinesPerPair = legacySpaces.lines.maxLinesPerPair ?? 1;
		variables.push(v);
		const grid = createVarGrid('line', rows, cols);
		for (let r = 0; r <= rows; r++) {
			for (let c = 0; c < cols; c++) {
				const le = legacyH[r]?.[c];
				const s = grid.h![r][c];
				s.value = le?.lines ?? null;
				s.isGiven = le?.lineIsGiven ?? false;
				s.marks = le?.linePencilMarks ? [...le.linePencilMarks] : [];
			}
		}
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c <= cols; c++) {
				const le = legacyV[r]?.[c];
				const s = grid.v![r][c];
				s.value = le?.lines ?? null;
				s.isGiven = le?.lineIsGiven ?? false;
				s.marks = le?.linePencilMarks ? [...le.linePencilMarks] : [];
			}
		}
		varData[v.id] = grid;
	}

	const cells = createCellGrid(rows, cols);
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++)
			cells[r][c].regionId = legacyCells[r]?.[c]?.regionId ?? 0;

	const legacyManual = (raw.manualGlobalRules ?? raw.globalRules ?? []) as unknown[];
	const legacyLocal = (raw.localRules ?? []) as (RuleInstance & { bindings?: string[] })[];
	for (const inst of legacyLocal) {
		if (!inst.bindings) inst.bindings = [];
	}

	// Legacy custom rules: strip removed spaces, normalize legacy group shape
	const customRules = ((raw.customRules ?? []) as CustomRuleDefinition[]).map((cr) => {
		const rs = (cr.requiredSpaces as string[])
			.flatMap((s) => (s === 'numbers' ? ['digits'] : [s]))
			.filter((s) => s !== 'values' && s !== 'modifier');
		const out = { ...cr, requiredSpaces: [...new Set(rs)] as CustomRuleDefinition['requiredSpaces'] };
		const g = out.groups as unknown as
			| { min: number; max: number; constraints: import('$lib/model/types').RuleGroupConfig }
			| import('$lib/model/types').RuleGroupConfig[]
			| undefined;
		if (g && !Array.isArray(g) && 'constraints' in g) {
			out.groups = Array.from({ length: g.max }, () => ({ ...g.constraints }));
		}
		return out;
	});

	const state: PuzzleState = {
		name: (raw.name as string) ?? 'Untitled Puzzle',
		dimensions: dims,
		variables,
		varData,
		cells,
		...createRegionEdgeGrids(rows, cols),
		manualGlobalRules: normalizeApplications(legacyManual),
		activeRulesets: normalizeActivations(raw.activeRulesets),
		globalRules: [],
		localRules: legacyLocal,
		customRules,
		ruleBindingDefaults: {}
	};
	syncEffectiveGlobalRules(state);
	return state;
}

/** Accept string ids (legacy) or application objects, producing valid applications */
function normalizeApplications(list: unknown): GlobalRuleApplication[] {
	if (!Array.isArray(list)) return [];
	return list.map((entry) => {
		if (typeof entry === 'string') {
			return { key: nanoid(8), ruleId: entry, bindings: [] };
		}
		const app = entry as GlobalRuleApplication;
		return {
			key: app.key ?? nanoid(8),
			ruleId: app.ruleId,
			bindings: app.bindings ?? []
		};
	});
}

