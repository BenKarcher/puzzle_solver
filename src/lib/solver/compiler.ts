import type {
	GeneratorContext,
	GlobalRuleApplication,
	LoadedRule,
	PuzzleState,
	RuleConfig,
	RuleInstance,
	VarKind
} from '$lib/model/types';
import { kindOfSpace, mznNamesFor, resolveBindingArrays, type MznNames } from '$lib/model/variables';
import { buildVariableSpaces, type VariableSpace } from './variable-spaces';
import { getImportSnippet } from '$lib/rules/registry';

/**
 * Compile a PuzzleState + loaded rules into a complete MiniZinc model string.
 */
export type ValueChoice = 'indomain_min' | 'indomain_max' | 'indomain_median';

export interface CompileOptions {
	/** When set, adds a search annotation with the given value choice strategy */
	valueChoice?: ValueChoice;
}

/** Symbolic index-set strings per (kind, solField position) matching descriptor dims */
function dimsFor(sp: VariableSpace, puzzle: PuzzleState): string {
	const { rows, cols } = puzzle.dimensions;
	if (sp.numRows === rows && sp.numCols === cols) return '1..rows, 1..cols';
	if (sp.numRows === rows + 1 && sp.numCols === cols) return '1..rows+1, 1..cols';
	if (sp.numRows === rows && sp.numCols === cols + 1) return '1..rows, 1..cols+1';
	if (sp.numRows === rows && sp.numCols === cols - 1) return '1..rows, 1..cols-1';
	if (sp.numRows === rows - 1 && sp.numCols === cols) return '1..rows-1, 1..cols';
	return `1..${sp.numRows}, 1..${sp.numCols}`;
}

function domainFor(sp: VariableSpace, puzzle: PuzzleState): string {
	const v = puzzle.variables.find((x) => x.id === sp.varId);
	if (sp.kind === 'number') return `${v?.min ?? 1}..${v?.max ?? 9}`;
	if (sp.kind === 'line') return `0..${v?.maxLinesPerPair ?? 1}`;
	return 'bool';
}

/** Variable declarations, one per instance facet. Constant instances become par literals. */
function emitDeclarations(puzzle: PuzzleState, spaces: VariableSpace[]): string[] {
	const lines: string[] = [];
	for (const sp of spaces) {
		const dims = dimsFor(sp, puzzle);
		if (sp.isConstant) {
			const parType = sp.resultKind === 'boolean' ? 'bool' : 'int';
			const vals: string[] = [];
			for (let r = 0; r < sp.numRows; r++)
				for (let c = 0; c < sp.numCols; c++)
					vals.push(String(sp.getGiven(r, c)));
			lines.push(
				`array[${dims}] of ${parType}: ${sp.solField} = array2d(${dims}, [${vals.join(', ')}]);`
			);
		} else {
			lines.push(`array[${dims}] of var ${domainFor(sp, puzzle)}: ${sp.solField};`);
		}
	}
	if (puzzle.variables.some((v) => v.kind === 'border' || v.kind === 'line')) {
		lines.push('int: TOP = 1; int: RIGHT = 2; int: BOTTOM = 3; int: LEFT = 4;');
	}
	return lines;
}

/** Given-value constraints (constant instances are baked into their declaration) */
function compileGivens(spaces: VariableSpace[]): string[] {
	const lines: string[] = [];
	for (const sp of spaces) {
		if (sp.isConstant) continue;
		for (let r = 0; r < sp.numRows; r++) {
			for (let c = 0; c < sp.numCols; c++) {
				const g = sp.getGiven(r, c);
				if (g !== undefined) {
					lines.push(`constraint ${sp.mznExpr(r, c)} = ${g};`);
				}
			}
		}
	}
	return lines;
}

function collectImports(usedRuleIds: Set<string>, rules: LoadedRule[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const ruleId of usedRuleIds) {
		const rule = rules.find((r) => r.config.id === ruleId);
		const imports = rule?.config.imports;
		if (!imports) continue;
		for (const name of imports) {
			if (seen.has(name)) continue;
			seen.add(name);
			const snippet = getImportSnippet(name);
			if (snippet === undefined) {
				console.warn(`[compiler] unknown import "${name}" requested by rule "${ruleId}"`);
				continue;
			}
			out.push(snippet.trimEnd());
		}
	}
	return out;
}

function needsSpace(usedRuleIds: Set<string>, rules: LoadedRule[], space: string): boolean {
	for (const ruleId of usedRuleIds) {
		const rule = rules.find((r) => r.config.id === ruleId);
		if (rule?.config.requiredSpaces.includes(space as never)) return true;
	}
	return false;
}

function compilePositions(puzzle: PuzzleState): string {
	const { rows, cols } = puzzle.dimensions;
	const counter = new Map<number, number>();
	const positions: number[][] = [];
	for (let r = 0; r < rows; r++) {
		positions[r] = [];
		for (let c = 0; c < cols; c++) {
			const regionId = puzzle.cells[r][c].regionId;
			const count = (counter.get(regionId) ?? 0) + 1;
			counter.set(regionId, count);
			positions[r][c] = count;
		}
	}
	return positions.map((row) => row.join(', ')).join(',\n  ');
}

/** Region/position data + shared imports, gated on the used rules */
function emitSharedData(
	puzzle: PuzzleState,
	rules: LoadedRule[],
	usedRuleIds: Set<string>
): string[] {
	const lines: string[] = [];
	if (needsSpace(usedRuleIds, rules, 'regions')) {
		const regionData = puzzle.cells
			.map((row) => row.map((c) => c.regionId).join(', '))
			.join(',\n  ');
		lines.push(`array[1..rows, 1..cols] of int: region = array2d(1..rows, 1..cols, [\n  ${regionData}\n]);`);
		lines.push('');
	}
	if (needsSpace(usedRuleIds, rules, 'positions')) {
		lines.push(`array[1..rows, 1..cols] of int: position = array2d(1..rows, 1..cols, [\n  ${compilePositions(puzzle)}\n]);`);
		lines.push('');
	}
	const importLines = collectImports(usedRuleIds, rules);
	if (importLines.length > 0) {
		lines.push('% Shared imports');
		lines.push(...importLines);
		lines.push('');
	}
	return lines;
}

/** Include each used rule's .mzn (predicate definitions) once */
function emitRuleMzn(usedRuleIds: Set<string>, rules: LoadedRule[]): string[] {
	const lines: string[] = [];
	const included = new Set<string>();
	for (const ruleId of usedRuleIds) {
		const rule = rules.find((r) => r.config.id === ruleId);
		if (!rule?.mzn) continue;
		if (included.has(ruleId)) continue;
		included.add(ruleId);
		lines.push(`% Rule: ${rule.config.name}`);
		lines.push(rule.mzn);
		lines.push('');
	}
	return lines;
}

/** Per-rule uniqueness counter for generator helper identifiers */
class UniqCounter {
	private counts = new Map<string, number>();
	next(ruleId: string): string {
		const n = (this.counts.get(ruleId) ?? 0) + 1;
		this.counts.set(ruleId, n);
		return n === 1 ? '' : `_${n}`;
	}
}

/** Emit one global rule application: generator output or a predicate call */
function emitGlobalApplication(
	app: GlobalRuleApplication,
	rule: LoadedRule,
	puzzle: PuzzleState,
	names: Map<string, MznNames>,
	uniq: UniqCounter
): string[] {
	const resolved = resolveBindingArrays(puzzle, rule.config, app.bindings, names);
	if (!resolved) return [`% Skipped ${rule.config.name}: unbound variable requirement`];

	if (rule.generate) {
		const ctx: GeneratorContext = { bindings: resolved, uniq: uniq.next(rule.config.id) };
		return [`% Generated: ${rule.config.name}`, ...rule.generate(puzzle, ctx)];
	}

	if (!rule.mzn) return [];
	const predicateName = rule.config.predicateName ?? rule.config.id.replace(/-/g, '_');
	const args = resolved.flatMap((b) => b.arrays);
	return [`constraint ${predicateName}(${args.join(', ')});`];
}

/**
 * Emit the predicate call for a local rule instance.
 * Argument order: wholeGrids arrays first, then per group:
 * [coordinates rows, cols]?, one cell-ref array per bindable requiredSpaces
 * occurrence (declared order), then the group value.
 */
function generatePredicateCall(
	config: RuleConfig,
	instance: RuleInstance,
	puzzle: PuzzleState,
	names: Map<string, MznNames>
): string | null {
	if (!config.groups || instance.groups.length === 0) return null;

	const resolved = resolveBindingArrays(puzzle, config, instance.bindings, names);
	if (!resolved) return null;

	const predicateName = config.predicateName ?? config.id.replace(/-/g, '_');
	const wholeCount = config.wholeGrids?.length ?? 0;
	const hasCoordinates = config.requiredSpaces.includes('coordinates');
	const { rows, cols } = puzzle.dimensions;

	const args: string[] = [];

	// 1. Whole-grid args
	for (let i = 0; i < wholeCount; i++) {
		args.push(...resolved[i].arrays);
	}

	// Bindable requiredSpaces occurrences (offset past wholeGrids in `resolved`)
	const cellOccurrences: { kind: VarKind; arrays: string[] }[] = [];
	{
		let idx = wholeCount;
		for (const space of config.requiredSpaces) {
			const kind = kindOfSpace(space);
			if (!kind) continue;
			cellOccurrences.push({ kind, arrays: resolved[idx].arrays });
			idx++;
		}
	}

	// 2. Per-group args
	for (let gi = 0; gi < instance.groups.length; gi++) {
		const group = instance.groups[gi];
		const groupCfg = config.groups[gi];
		if (!groupCfg) continue;
		const isCellless = groupCfg.maxSize === 0;

		// Validation: reject call if we can't produce a valid constraint
		if (groupCfg.hasValue && group.value === null) return null;
		if (!isCellless && groupCfg.minSize > 0 && group.cells.length < groupCfg.minSize) return null;

		if (!isCellless && group.cells.length > 0) {
			if (hasCoordinates) {
				args.push(`[${group.cells.map((c) => c.row + 1).join(', ')}]`);
				args.push(`[${group.cells.map((c) => c.col + 1).join(', ')}]`);
			}

			for (const occ of cellOccurrences) {
				const name0 = occ.arrays[0];
				const name1 = occ.arrays[1];
				if (occ.kind === 'number' || occ.kind === 'boolean') {
					const refs = group.cells
						.map((c) => `${name0}[${c.row + 1},${c.col + 1}]`)
						.join(', ');
					args.push(`[${refs}]`);
				} else if (occ.kind === 'border') {
					const edgeRefs: string[] = [];
					for (const cell of group.cells) {
						const mznR = cell.row + 1;
						const mznC = cell.col + 1;
						edgeRefs.push(
							`${name0}[${mznR},${mznC}]`,      // top
							`${name1}[${mznR},${mznC + 1}]`,  // right
							`${name0}[${mznR + 1},${mznC}]`,  // bottom
							`${name1}[${mznR},${mznC}]`       // left
						);
					}
					args.push(`array2d(1..${group.cells.length}, 1..4, [${edgeRefs.join(', ')}])`);
				} else {
					// line kind: interior only — boundary sides get constant 0
					const edgeRefs: string[] = [];
					for (const cell of group.cells) {
						const r = cell.row;
						const c = cell.col;
						edgeRefs.push(
							r > 0 ? `${name1}[${r},${c + 1}]` : '0',
							c < cols - 1 ? `${name0}[${r + 1},${c + 1}]` : '0',
							r < rows - 1 ? `${name1}[${r + 1},${c + 1}]` : '0',
							c > 0 ? `${name0}[${r + 1},${c}]` : '0'
						);
					}
					args.push(`array2d(1..${group.cells.length}, 1..4, [${edgeRefs.join(', ')}])`);
				}
			}
		}

		if (groupCfg.hasValue) {
			args.push(`${group.value}`);
		}
	}

	if (args.length === 0) return null;
	return `constraint ${predicateName}(${args.join(', ')});`;
}

/** Emit generator output or predicate call for one local instance */
function emitLocalInstance(
	instance: RuleInstance,
	rule: LoadedRule,
	puzzle: PuzzleState,
	names: Map<string, MznNames>,
	uniq: UniqCounter
): string[] {
	if (rule.generate) {
		const resolved = resolveBindingArrays(puzzle, rule.config, instance.bindings, names);
		if (!resolved) return [`% Skipped ${rule.config.name}: unbound variable requirement`];
		const ctx: GeneratorContext = { bindings: resolved, uniq: uniq.next(rule.config.id) };
		return [`% Generated: ${rule.config.name} (instance)`, ...rule.generate(puzzle, ctx, instance)];
	}
	if (rule.mzn && rule.config.scope === 'local') {
		const call = generatePredicateCall(rule.config, instance, puzzle, names);
		return call ? [call] : [];
	}
	return [];
}

export function compilePuzzle(puzzle: PuzzleState, rules: LoadedRule[], options?: CompileOptions): string {
	const lines: string[] = [];
	const spaces = buildVariableSpaces(puzzle);
	const names = mznNamesFor(puzzle);

	// 1. Dimensions
	lines.push(`int: rows = ${puzzle.dimensions.rows};`);
	lines.push(`int: cols = ${puzzle.dimensions.cols};`);
	lines.push('');

	// 2. Variable declarations
	lines.push(...emitDeclarations(puzzle, spaces));
	lines.push('');

	// 3. Which rules are used (gates region/position data and imports)
	const usedRuleIds = new Set<string>([
		...puzzle.globalRules.map((a) => a.ruleId),
		...puzzle.localRules.map((inst) => inst.ruleId)
	]);

	// 4. Region/position data + shared imports
	lines.push(...emitSharedData(puzzle, rules, usedRuleIds));

	// 5. Given constraints
	const givenLines = compileGivens(spaces);
	if (givenLines.length > 0) {
		lines.push('% Givens');
		lines.push(...givenLines);
		lines.push('');
	}

	// 6. Rule predicate definitions
	lines.push(...emitRuleMzn(usedRuleIds, rules));

	// 7. Global rule applications
	const uniq = new UniqCounter();
	for (const app of puzzle.globalRules) {
		const rule = rules.find((r) => r.config.id === app.ruleId);
		if (!rule) continue;
		const out = emitGlobalApplication(app, rule, puzzle, names, uniq);
		if (out.length > 0) {
			lines.push(...out);
			lines.push('');
		}
	}

	// 8. Local rule instances
	for (const instance of puzzle.localRules) {
		const rule = rules.find((r) => r.config.id === instance.ruleId);
		if (!rule) continue;
		lines.push(...emitLocalInstance(instance, rule, puzzle, names, uniq));
	}

	lines.push('');

	if (options?.valueChoice) {
		const vc = options.valueChoice;
		const searchAnnotations: string[] = [];
		for (const sp of spaces) {
			if (sp.isConstant) continue;
			const dims = dimsFor(sp, puzzle);
			const [d1, d2] = dims.split(', ');
			const comp = `[${sp.solField}[i,j] | i in ${d1}, j in ${d2}]`;
			if (sp.resultKind === 'boolean') {
				searchAnnotations.push(`bool_search(${comp}, input_order, ${vc})`);
			} else {
				searchAnnotations.push(`int_search(${comp}, first_fail, ${vc})`);
			}
		}
		if (searchAnnotations.length > 0) {
			lines.push(`solve :: seq_search([${searchAnnotations.join(', ')}]) satisfy;`);
		} else {
			lines.push('solve satisfy;');
		}
	} else {
		lines.push('solve satisfy;');
	}

	return lines.join('\n');
}

/**
 * Compile a model for checking a user's solution.
 * All user values are fixed as constraints (treating null booleans as false, null lines as 0).
 * Optionally restrict to specific global applications (by key) and/or local instances (by id)
 * for per-rule violation checking.
 */
export function compilePuzzleForCheck(
	puzzle: PuzzleState,
	rules: LoadedRule[],
	onlyGlobalKeys?: Set<string>,
	onlyLocalInstances?: Set<string>
): string {
	const lines: string[] = [];
	const spaces = buildVariableSpaces(puzzle);
	const names = mznNamesFor(puzzle);
	const filterRules = onlyGlobalKeys !== undefined || onlyLocalInstances !== undefined;

	// 1. Dimensions
	lines.push(`int: rows = ${puzzle.dimensions.rows};`);
	lines.push(`int: cols = ${puzzle.dimensions.cols};`);
	lines.push('');

	// 2. Variable declarations
	lines.push(...emitDeclarations(puzzle, spaces));
	lines.push('');

	// Determine which rules to include
	const globalApps = filterRules
		? puzzle.globalRules.filter((a) => onlyGlobalKeys?.has(a.key))
		: puzzle.globalRules;
	const localRules = filterRules
		? puzzle.localRules.filter((inst) => onlyLocalInstances?.has(inst.id))
		: puzzle.localRules;
	const usedRuleIds = new Set<string>([
		...globalApps.map((a) => a.ruleId),
		...localRules.map((inst) => inst.ruleId)
	]);

	// 3. Region/position data + shared imports
	lines.push(...emitSharedData(puzzle, rules, usedRuleIds));

	// 4. Fix ALL user values as constraints (not just givens)
	lines.push('% User solution values');
	for (const sp of spaces) {
		if (sp.isConstant) continue;
		for (let r = 0; r < sp.numRows; r++) {
			for (let c = 0; c < sp.numCols; c++) {
				const val = sp.getValue(r, c);
				if (sp.kind === 'number') {
					if (val !== null) lines.push(`constraint ${sp.mznExpr(r, c)} = ${val};`);
				} else if (sp.kind === 'line') {
					lines.push(`constraint ${sp.mznExpr(r, c)} = ${val ?? 0};`);
				} else {
					lines.push(`constraint ${sp.mznExpr(r, c)} = ${val ?? false};`);
				}
			}
		}
	}
	lines.push('');

	// 5. Rule predicate definitions
	lines.push(...emitRuleMzn(usedRuleIds, rules));

	// 6. Global rule applications
	const uniq = new UniqCounter();
	for (const app of globalApps) {
		const rule = rules.find((r) => r.config.id === app.ruleId);
		if (!rule) continue;
		const out = emitGlobalApplication(app, rule, puzzle, names, uniq);
		if (out.length > 0) {
			lines.push(...out);
			lines.push('');
		}
	}

	// 7. Local rule instances
	for (const instance of localRules) {
		const rule = rules.find((r) => r.config.id === instance.ruleId);
		if (!rule) continue;
		lines.push(...emitLocalInstance(instance, rule, puzzle, names, uniq));
	}

	lines.push('');
	lines.push('solve satisfy;');
	return lines.join('\n');
}
