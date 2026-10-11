import { nanoid } from 'nanoid';
import type {
	CellCoord,
	CellValue,
	CellVarState,
	CustomRuleDefinition,
	EdgeCoord,
	GlobalRuleApplication,
	PuzzleState,
	RegionLayout,
	RuleGroup,
	RuleInstance,
	RulesetConfig,
	VarKind,
	VariableInstance
} from '$lib/model/types';
import {
	applyRegionLayout,
	createBlankPuzzle,
	createVariableInstance,
	pickDefaultColor,
	resizePuzzle
} from '$lib/model/defaults';
import { createVarGrid, defaultBindings, validatedBindings } from '$lib/model/variables';
import { migratePuzzleJSON, syncEffectiveGlobalRules } from '$lib/model/migrate';
import { defaultRulesetBindings, entryId, memberRuleBindings, rulesetRuleIds } from '$lib/rules/rulesets';
import type { CandidateResult } from '$lib/solver/candidates';
import { buildVariableSpaces } from '$lib/solver/variable-spaces';
import { history } from './history.svelte';
import { getRuleById, getRulesetById } from '$lib/rules/registry';
import { ui } from './ui.svelte';

/** Signature used to compare two applications' bindings */
function bindingsSig(bindings: string[] | undefined): string {
	return (bindings ?? []).join(',');
}

/** One variable to create from the quickstart page (a merged slot group) */
export interface QuickstartVariable {
	kind: VarKind;
	name: string;
	render?: VariableInstance['render'];
	color?: string;
	emojis?: string[];
	constant?: boolean;
	defaultValue?: number | boolean;
	min?: number;
	max?: number;
	maxLinesPerPair?: number;
}

export interface QuickstartSpec {
	rows: number;
	cols: number;
	regions: RegionLayout;
	boxRows?: number;
	boxCols?: number;
	variables: QuickstartVariable[];
	/** Per selected ruleset: which created variable (by index) fills each slot */
	activations: { rulesetId: string; varIndices: number[] }[];
}

class PuzzleStore {
	puzzle = $state<PuzzleState>(createBlankPuzzle(9, 9));
	/** Increments on every edit — watchers use this to detect puzzle changes. */
	editCount = $state(0);

	get rows(): number {
		return this.puzzle.dimensions.rows;
	}

	get cols(): number {
		return this.puzzle.dimensions.cols;
	}

	private pushHistory(): void {
		this.editCount++;
		history.push(structuredClone($state.snapshot(this.puzzle)));
	}

	private restoreFromHistory(snapshot: PuzzleState | null): void {
		if (snapshot) {
			this.puzzle = snapshot;
		}
	}

	// ---- Initialization ----

	newPuzzle(rows: number = 9, cols: number = 9): void {
		this.puzzle = createBlankPuzzle(rows, cols);
		history.clear();
		history.push(structuredClone($state.snapshot(this.puzzle)));
	}

	loadPuzzle(state: PuzzleState): void {
		this.puzzle = state;
		this.syncEffectiveGlobalRules();
		history.clear();
		history.push(structuredClone($state.snapshot(this.puzzle)));
		ui.autoFavoriteUsedRules(
			state.globalRules.map((a) => a.ruleId),
			state.localRules
		);
	}

	// ---- Undo / Redo ----

	undo(): void {
		this.restoreFromHistory(history.undo());
	}

	redo(): void {
		this.restoreFromHistory(history.redo());
	}

	// ---- Grid dimensions ----

	setDimensions(rows: number, cols: number): void {
		this.pushHistory();
		this.puzzle = resizePuzzle($state.snapshot(this.puzzle), rows, cols);
	}

	// ---- Variable instances ----

	getVariable(varId: string): VariableInstance | undefined {
		return this.puzzle.variables.find((v) => v.id === varId);
	}

	addVariable(kind: VarKind, name?: string): string {
		this.pushHistory();
		const v = createVariableInstance(kind, name);
		// Disambiguate default names: "Numbers", "Numbers 2", ...
		if (!name) {
			const sameKind = this.puzzle.variables.filter((x) => x.kind === kind).length;
			if (sameKind > 0) v.name = `${v.name} ${sameKind + 1}`;
		}
		// Give colored kinds a distinct default color
		if (kind !== 'number') {
			v.color = pickDefaultColor(this.puzzle.variables, kind);
		}
		this.puzzle.variables = [...this.puzzle.variables, v];
		this.puzzle.varData[v.id] = createVarGrid(kind, this.rows, this.cols);
		return v.id;
	}

	/** Remove a variable, its data, and every rule application bound to it. */
	removeVariable(varId: string): void {
		this.pushHistory();
		this.puzzle.variables = this.puzzle.variables.filter((v) => v.id !== varId);
		delete this.puzzle.varData[varId];
		this.puzzle.manualGlobalRules = this.puzzle.manualGlobalRules.filter(
			(a) => !a.bindings.includes(varId)
		);
		this.puzzle.localRules = this.puzzle.localRules.filter(
			(inst) => !inst.bindings.includes(varId)
		);
		if (ui.activeVarId === varId) ui.activeVarId = null;
		this.syncEffectiveGlobalRules();
	}

	updateVariable(varId: string, patch: Partial<VariableInstance>): void {
		this.pushHistory();
		this.puzzle.variables = this.puzzle.variables.map((v) =>
			v.id === varId ? { ...v, ...patch, id: v.id, kind: v.kind } : v
		);
	}

	moveVariable(varId: string, delta: -1 | 1): void {
		const idx = this.puzzle.variables.findIndex((v) => v.id === varId);
		const target = idx + delta;
		if (idx < 0 || target < 0 || target >= this.puzzle.variables.length) return;
		this.pushHistory();
		const vars = [...this.puzzle.variables];
		[vars[idx], vars[target]] = [vars[target], vars[idx]];
		this.puzzle.variables = vars;
	}

	// ---- Value access ----

	getCellVar(varId: string, coord: CellCoord): CellVarState | null {
		return this.puzzle.varData[varId]?.cells?.[coord.row]?.[coord.col] ?? null;
	}

	getEdgeVar(varId: string, coord: EdgeCoord): CellVarState | null {
		const grid = this.puzzle.varData[varId];
		if (!grid) return null;
		const arr = coord.direction === 'h' ? grid.h : grid.v;
		return arr?.[coord.row]?.[coord.col] ?? null;
	}

	// ---- Cell-kind mutations ----

	setCellVar(varId: string, coord: CellCoord, value: number | boolean | null, isGiven: boolean): void {
		const s = this.getCellVar(varId, coord);
		if (!s) return;
		this.pushHistory();
		s.value = value;
		s.isGiven = value !== null && isGiven;
		s.marks = [];
	}

	/** Cycle a boolean variable: null → true → false → null */
	toggleCellBoolean(varId: string, coord: CellCoord, isGiven: boolean): void {
		const s = this.getCellVar(varId, coord);
		if (!s) return;
		const next = s.value === true ? false : s.value === false ? null : true;
		this.setCellVar(varId, coord, next, isGiven);
	}

	toggleMark(varId: string, coord: CellCoord, value: number): void {
		const s = this.getCellVar(varId, coord);
		if (!s) return;
		this.pushHistory();
		const idx = s.marks.indexOf(value);
		if (idx >= 0) {
			s.marks = s.marks.filter((v) => v !== value);
		} else {
			s.marks = [...s.marks, value].sort((a, b) => a - b);
		}
	}

	setRegionId(coord: CellCoord, id: number): void {
		this.pushHistory();
		this.puzzle.cells[coord.row][coord.col].regionId = id;
	}

	/** Clear every cell-kind variable at a cell (Design mode delete) */
	clearCell(coord: CellCoord): void {
		this.pushHistory();
		for (const v of this.puzzle.variables) {
			const s = this.puzzle.varData[v.id]?.cells?.[coord.row]?.[coord.col];
			if (s) {
				s.value = null;
				s.isGiven = false;
				s.marks = [];
			}
		}
	}

	/** Clear only non-given cell-kind data at a cell (Solve mode delete) */
	clearNonGivens(coord: CellCoord): void {
		this.pushHistory();
		for (const v of this.puzzle.variables) {
			const s = this.puzzle.varData[v.id]?.cells?.[coord.row]?.[coord.col];
			if (s && !s.isGiven) {
				s.value = null;
				s.marks = [];
			}
		}
	}

	// ---- Edge-kind mutations ----

	setEdgeVar(varId: string, coord: EdgeCoord, value: number | boolean | null, isGiven: boolean): void {
		const s = this.getEdgeVar(varId, coord);
		if (!s) return;
		this.pushHistory();
		s.value = value;
		s.isGiven = value !== null && isGiven;
		s.marks = [];
	}

	incrementEdgeLines(varId: string, coord: EdgeCoord, isGiven: boolean): void {
		const v = this.getVariable(varId);
		const s = this.getEdgeVar(varId, coord);
		if (!v || !s) return;
		const maxLines = v.maxLinesPerPair ?? 1;
		// null → 1 → 2 → ... → max → null
		const current = typeof s.value === 'number' ? s.value : 0;
		const newValue = current >= maxLines ? null : current + 1;
		this.setEdgeVar(varId, coord, newValue, isGiven);
	}

	// ---- Batch operations for solving mode ----

	private applyClearSolveEntries(): void {
		const spaces = buildVariableSpaces(this.puzzle);
		for (const sp of spaces) {
			for (let r = 0; r < sp.numRows; r++) {
				for (let c = 0; c < sp.numCols; c++) {
					sp.clearValue(r, c);
				}
			}
		}
	}

	/** Clear solve entries and record as a user edit (increments editCount, supports undo). */
	clearSolveEntries(): void {
		this.pushHistory();
		this.applyClearSolveEntries();
	}

	/** Clear solve entries without registering as a user edit — used by the solver internally. */
	clearSolveEntriesQuiet(): void {
		this.applyClearSolveEntries();
	}

	// ---- Global rules ----

	/** Recompute puzzle.globalRules = manual applications ∪ default-bound ruleset rules. */
	private syncEffectiveGlobalRules(): void {
		syncEffectiveGlobalRules(this.puzzle);
	}

	/** Re-sync effective rules (e.g. after registry changes). */
	resyncGlobalRules(): void {
		this.syncEffectiveGlobalRules();
	}

	/** Add a global rule application. Returns its key. */
	addGlobalRule(ruleId: string, bindings?: string[]): string {
		this.pushHistory();
		const rule = getRuleById(ruleId);
		const resolved = bindings ?? (rule ? defaultBindings(this.puzzle, rule.config) : []);
		const key = nanoid(8);
		this.puzzle.manualGlobalRules = [
			...this.puzzle.manualGlobalRules,
			{ key, ruleId, bindings: resolved }
		];
		this.syncEffectiveGlobalRules();
		return key;
	}

	removeGlobalRule(key: string): void {
		this.pushHistory();
		this.puzzle.manualGlobalRules = this.puzzle.manualGlobalRules.filter((a) => a.key !== key);
		this.syncEffectiveGlobalRules();
	}

	/**
	 * Toggle a global rule with the given (or default) bindings: removes the matching
	 * manual application if one exists, otherwise adds one.
	 */
	toggleGlobalRule(ruleId: string, bindings?: string[]): void {
		const rule = getRuleById(ruleId);
		const resolved = bindings ?? (rule ? defaultBindings(this.puzzle, rule.config) : []);
		const sig = bindingsSig(resolved);
		const existing = this.puzzle.manualGlobalRules.find(
			(a) => a.ruleId === ruleId && bindingsSig(a.bindings) === sig
		);
		if (existing) {
			this.removeGlobalRule(existing.key);
		} else {
			this.addGlobalRule(ruleId, resolved);
		}
	}

	/** True if any application (manual or ruleset) of this rule is active */
	isGlobalRuleActive(ruleId: string): boolean {
		return this.puzzle.globalRules.some((a) => a.ruleId === ruleId);
	}

	// ---- Rule sets ----

	isRulesetActive(rulesetId: string): boolean {
		return this.puzzle.activeRulesets.some((a) => a.rulesetId === rulesetId);
	}

	/** Seed local member rules' binding defaults from a ruleset's slot bindings */
	private seedLocalMemberDefaults(rs: RulesetConfig, slotBindings: string[]): void {
		for (const entry of rs.rules) {
			const id = entryId(entry);
			const rule = getRuleById(id);
			if (!rule || rule.config.scope !== 'local') continue;
			this.puzzle.ruleBindingDefaults[id] = memberRuleBindings(rs, entry, slotBindings);
		}
	}

	toggleRuleset(rulesetId: string): void {
		this.pushHistory();
		if (this.isRulesetActive(rulesetId)) {
			this.puzzle.activeRulesets = this.puzzle.activeRulesets.filter(
				(a) => a.rulesetId !== rulesetId
			);
			if (ui.selectedRulesetId === rulesetId) ui.selectedRulesetId = null;
		} else {
			const rs = getRulesetById(rulesetId);
			if (!rs) return;
			const bindings = defaultRulesetBindings(this.puzzle, rs);
			this.puzzle.activeRulesets = [
				...this.puzzle.activeRulesets,
				{ rulesetId, bindings }
			];
			// Favorite local rules in the set and point their binding defaults at the set's slots
			const localRuleIds = rulesetRuleIds(rs).filter((id) => {
				const r = getRuleById(id);
				return r && r.config.scope === 'local';
			});
			if (localRuleIds.length > 0) {
				ui.favoriteRules = new Set([...ui.favoriteRules, ...localRuleIds]);
			}
			this.seedLocalMemberDefaults(rs, bindings);
		}
		this.syncEffectiveGlobalRules();
	}

	/** Bind one of an active ruleset's variable slots to a different instance */
	setRulesetBinding(rulesetId: string, slotIndex: number, varId: string): void {
		const activation = this.puzzle.activeRulesets.find((a) => a.rulesetId === rulesetId);
		if (!activation) return;
		this.pushHistory();
		const rs = getRulesetById(rulesetId);
		const bindings = activation.bindings.length
			? [...activation.bindings]
			: rs ? defaultRulesetBindings(this.puzzle, rs) : [];
		while (bindings.length <= slotIndex) bindings.push('');
		bindings[slotIndex] = varId;
		activation.bindings = bindings;
		if (rs) this.seedLocalMemberDefaults(rs, bindings);
		this.syncEffectiveGlobalRules();
	}

	/** Rebind one occurrence of a manual global rule application */
	setGlobalRuleBinding(key: string, occurrenceIndex: number, varId: string): void {
		const app = this.puzzle.manualGlobalRules.find((a) => a.key === key);
		if (!app) return;
		this.pushHistory();
		const bindings = [...app.bindings];
		while (bindings.length <= occurrenceIndex) bindings.push('');
		bindings[occurrenceIndex] = varId;
		app.bindings = bindings;
		this.puzzle.manualGlobalRules = [...this.puzzle.manualGlobalRules];
		this.syncEffectiveGlobalRules();
	}

	// ---- Local rules ----

	addRuleInstance(ruleId: string): string {
		this.pushHistory();
		const id = nanoid();
		const rule = getRuleById(ruleId);
		const groupCount = rule?.config.groups?.length ?? 1;
		const groups: RuleGroup[] = Array.from({ length: groupCount }, (_, gi) => ({
			cells: [],
			value: rule?.config.groups?.[gi]?.defaultValue ?? null
		}));
		// Start from the remembered defaults for this rule (last edit or ruleset seed)
		const bindings = rule
			? validatedBindings(this.puzzle, rule.config, this.puzzle.ruleBindingDefaults[ruleId])
			: [];
		const instance: RuleInstance = { ruleId, id, groups, bindings };
		this.puzzle.localRules = [...this.puzzle.localRules, instance];
		return id;
	}

	removeRuleInstance(instanceId: string): void {
		this.pushHistory();
		this.puzzle.localRules = this.puzzle.localRules.filter((r) => r.id !== instanceId);
	}

	setInstanceBinding(instanceId: string, occurrenceIndex: number, varId: string): void {
		const instance = this.puzzle.localRules.find((r) => r.id === instanceId);
		if (!instance) return;
		this.pushHistory();
		const bindings = [...instance.bindings];
		while (bindings.length <= occurrenceIndex) bindings.push('');
		bindings[occurrenceIndex] = varId;
		instance.bindings = bindings;
		// Remember as the default for the next instance of this rule
		this.puzzle.ruleBindingDefaults[instance.ruleId] = [...bindings];
	}

	addCellToGroup(instanceId: string, groupIndex: number, coord: CellCoord): void {
		const instance = this.puzzle.localRules.find((r) => r.id === instanceId);
		if (!instance) return;
		const group = instance.groups[groupIndex];
		if (!group) return;
		// Enforce per-group maxSize; maxSize === 0 means cell-less (reject entirely)
		const rule = getRuleById(instance.ruleId);
		const groupCfg = rule?.config.groups?.[groupIndex];
		const maxSize = groupCfg?.maxSize;
		if (maxSize === 0) return;
		if (maxSize !== null && maxSize !== undefined && group.cells.length >= maxSize) return;
		// Reject duplicates unless allowRepeats is set
		if (!groupCfg?.allowRepeats) {
			const exists = group.cells.some((c) => c.row === coord.row && c.col === coord.col);
			if (exists) return;
		}
		this.pushHistory();
		group.cells = [...group.cells, { ...coord }];
	}

	removeLastOccurrenceFromGroup(instanceId: string, groupIndex: number, coord: CellCoord): void {
		const instance = this.puzzle.localRules.find((r) => r.id === instanceId);
		if (!instance) return;
		const group = instance.groups[groupIndex];
		if (!group) return;
		let lastIdx = -1;
		for (let i = group.cells.length - 1; i >= 0; i--) {
			const c = group.cells[i];
			if (c.row === coord.row && c.col === coord.col) { lastIdx = i; break; }
		}
		if (lastIdx === -1) return;
		this.pushHistory();
		group.cells = group.cells.filter((_, i) => i !== lastIdx);
	}

	removeCellFromGroup(instanceId: string, groupIndex: number, coord: CellCoord): void {
		this.pushHistory();
		const instance = this.puzzle.localRules.find((r) => r.id === instanceId);
		if (!instance) return;
		const group = instance.groups[groupIndex];
		if (!group) return;
		group.cells = group.cells.filter((c) => c.row !== coord.row || c.col !== coord.col);
	}

	/** Replace a group's cells with every cell that shares the given region ID. */
	setGroupToRegion(instanceId: string, groupIndex: number, regionId: number): void {
		this.pushHistory();
		const instance = this.puzzle.localRules.find((r) => r.id === instanceId);
		if (!instance) return;
		const group = instance.groups[groupIndex];
		if (!group) return;
		const { rows, cols } = this.puzzle.dimensions;
		const cells: CellCoord[] = [];
		for (let r = 0; r < rows; r++)
			for (let c = 0; c < cols; c++)
				if (this.puzzle.cells[r][c].regionId === regionId)
					cells.push({ row: r, col: c });
		group.cells = cells;
	}

	toggleCellInGroup(instanceId: string, groupIndex: number, coord: CellCoord): void {
		const instance = this.puzzle.localRules.find((r) => r.id === instanceId);
		if (!instance) return;
		const group = instance.groups[groupIndex];
		if (!group) return;
		const exists = group.cells.some((c) => c.row === coord.row && c.col === coord.col);
		if (exists) {
			this.removeCellFromGroup(instanceId, groupIndex, coord);
		} else {
			this.addCellToGroup(instanceId, groupIndex, coord);
		}
	}

	setGroupValue(instanceId: string, groupIndex: number, value: number | null): void {
		this.pushHistory();
		const instance = this.puzzle.localRules.find((r) => r.id === instanceId);
		if (!instance) return;
		const group = instance.groups[groupIndex];
		if (group) {
			group.value = value;
		}
	}

	// ---- Region editing helpers ----

	/**
	 * Flood-fill the grid using current region edges as barriers and assign
	 * region IDs in top-left → bottom-right order. Does NOT push history.
	 */
	numberRegionsQuiet(): void {
		const { rows, cols } = this.puzzle.dimensions;
		const ids = new Int32Array(rows * cols).fill(-1);
		const key = (r: number, c: number) => r * cols + c;
		let nextId = 0;

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				if (ids[key(r, c)] !== -1) continue;
				const queue: [number, number][] = [[r, c]];
				ids[key(r, c)] = nextId;
				let qi = 0;
				while (qi < queue.length) {
					const [cr, cc] = queue[qi++];
					// Up:    regionEdgesH[cr][cc]
					if (cr > 0 && ids[key(cr - 1, cc)] === -1 && this.puzzle.regionEdgesH[cr]?.[cc] !== true) {
						ids[key(cr - 1, cc)] = nextId; queue.push([cr - 1, cc]);
					}
					// Down:  regionEdgesH[cr+1][cc]
					if (cr < rows - 1 && ids[key(cr + 1, cc)] === -1 && this.puzzle.regionEdgesH[cr + 1]?.[cc] !== true) {
						ids[key(cr + 1, cc)] = nextId; queue.push([cr + 1, cc]);
					}
					// Left:  regionEdgesV[cr][cc]
					if (cc > 0 && ids[key(cr, cc - 1)] === -1 && this.puzzle.regionEdgesV[cr]?.[cc] !== true) {
						ids[key(cr, cc - 1)] = nextId; queue.push([cr, cc - 1]);
					}
					// Right: regionEdgesV[cr][cc+1]
					if (cc < cols - 1 && ids[key(cr, cc + 1)] === -1 && this.puzzle.regionEdgesV[cr]?.[cc + 1] !== true) {
						ids[key(cr, cc + 1)] = nextId; queue.push([cr, cc + 1]);
					}
				}
				nextId++;
			}
		}

		for (let r = 0; r < rows; r++)
			for (let c = 0; c < cols; c++)
				this.puzzle.cells[r][c].regionId = ids[key(r, c)];
	}

	setRegionEdge(coord: EdgeCoord, value: boolean): void {
		this.pushHistory();
		const grid = coord.direction === 'h' ? this.puzzle.regionEdgesH : this.puzzle.regionEdgesV;
		if (grid[coord.row] !== undefined && grid[coord.row][coord.col] !== undefined) {
			grid[coord.row][coord.col] = value;
		}
	}

	getRegionEdge(coord: EdgeCoord): boolean {
		const grid = coord.direction === 'h' ? this.puzzle.regionEdgesH : this.puzzle.regionEdgesV;
		return grid[coord.row]?.[coord.col] === true;
	}

	/**
	 * Convert current regionId assignments into region edges, then re-number.
	 * Called when entering draw-edges sub-mode.
	 */
	initDrawEdgesMode(): void {
		this.pushHistory();
		const { rows, cols } = this.puzzle.dimensions;

		// Draw an edge wherever adjacent cells belong to different regions
		for (let r = 0; r < rows - 1; r++) {
			for (let c = 0; c < cols; c++) {
				this.puzzle.regionEdgesH[r + 1][c] =
					this.puzzle.cells[r][c].regionId !== this.puzzle.cells[r + 1][c].regionId;
			}
		}
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols - 1; c++) {
				this.puzzle.regionEdgesV[r][c + 1] =
					this.puzzle.cells[r][c].regionId !== this.puzzle.cells[r][c + 1].regionId;
			}
		}

		this.numberRegionsQuiet();
	}

	/**
	 * Remove region edges that don't separate different regions (partial/dead edges).
	 * Called when leaving draw-edges sub-mode or leaving region-edit entirely.
	 */
	cleanupDrawEdgesMode(): void {
		const { rows, cols } = this.puzzle.dimensions;

		for (let r = 0; r < rows - 1; r++) {
			for (let c = 0; c < cols; c++) {
				if (this.puzzle.regionEdgesH[r + 1][c] && this.puzzle.cells[r][c].regionId === this.puzzle.cells[r + 1][c].regionId)
					this.puzzle.regionEdgesH[r + 1][c] = false;
			}
		}
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols - 1; c++) {
				if (this.puzzle.regionEdgesV[r][c + 1] && this.puzzle.cells[r][c].regionId === this.puzzle.cells[r][c + 1].regionId)
					this.puzzle.regionEdgesV[r][c + 1] = false;
			}
		}
	}

	/** Set every interior region edge (making each cell its own region), then re-number. */
	populateAllEdges(): void {
		this.pushHistory();
		const { rows, cols } = this.puzzle.dimensions;

		for (let r = 1; r < rows; r++)
			for (let c = 0; c < cols; c++) this.puzzle.regionEdgesH[r][c] = true;

		for (let r = 0; r < rows; r++)
			for (let c = 1; c < cols; c++) this.puzzle.regionEdgesV[r][c] = true;

		this.numberRegionsQuiet();
	}

	// ---- Quickstart ----

	/**
	 * Build a fresh puzzle from the quickstart page: one variable per merged
	 * slot group, region layout applied, and every chosen ruleset activated
	 * with its slots bound to the created variables.
	 */
	applyQuickstart(spec: QuickstartSpec): void {
		const p = createBlankPuzzle(spec.rows, spec.cols);

		const ids: string[] = [];
		for (const qv of spec.variables) {
			const inst = createVariableInstance(qv.kind, qv.name);
			if (qv.min !== undefined) inst.min = qv.min;
			if (qv.max !== undefined) inst.max = qv.max;
			if (qv.maxLinesPerPair !== undefined) inst.maxLinesPerPair = qv.maxLinesPerPair;
			if (qv.render) inst.render = qv.render;
			if (qv.emojis) inst.emojis = [...qv.emojis];
			if (qv.constant) inst.constant = true;
			if (qv.defaultValue !== undefined) inst.defaultValue = qv.defaultValue;
			inst.color = qv.color ?? (qv.kind !== 'number' ? pickDefaultColor(p.variables, qv.kind) : undefined);
			p.variables.push(inst);
			p.varData[inst.id] = createVarGrid(qv.kind, spec.rows, spec.cols);
			ids.push(inst.id);
		}

		applyRegionLayout(p, spec.regions, spec.boxRows, spec.boxCols);

		p.activeRulesets = spec.activations.map((a) => ({
			rulesetId: a.rulesetId,
			bindings: a.varIndices.map((i) => ids[i] ?? '')
		}));
		syncEffectiveGlobalRules(p);
		this.loadPuzzle(p);

		// Favorite local members and seed their binding defaults from the slot bindings
		for (const activation of this.puzzle.activeRulesets) {
			const rs = getRulesetById(activation.rulesetId);
			if (!rs) continue;
			const localRuleIds = rulesetRuleIds(rs).filter((id) => {
				const r = getRuleById(id);
				return r && r.config.scope === 'local';
			});
			if (localRuleIds.length > 0) {
				ui.favoriteRules = new Set([...ui.favoriteRules, ...localRuleIds]);
			}
			this.seedLocalMemberDefaults(rs, activation.bindings);
		}
	}

	// ---- Custom rules ----

	addCustomRule(rule: CustomRuleDefinition): void {
		this.pushHistory();
		this.puzzle.customRules = [...this.puzzle.customRules, rule];
		// Auto-enable global custom rules
		if (rule.scope === 'global') {
			this.puzzle.manualGlobalRules = [
				...this.puzzle.manualGlobalRules,
				{ key: nanoid(8), ruleId: rule.id, bindings: defaultBindings(this.puzzle, rule) }
			];
			this.syncEffectiveGlobalRules();
		}
	}

	updateCustomRule(rule: CustomRuleDefinition): void {
		this.pushHistory();
		this.puzzle.customRules = this.puzzle.customRules.map((r) =>
			r.id === rule.id ? rule : r
		);
	}

	removeCustomRule(ruleId: string): void {
		this.pushHistory();
		this.puzzle.customRules = this.puzzle.customRules.filter((r) => r.id !== ruleId);
		this.puzzle.manualGlobalRules = this.puzzle.manualGlobalRules.filter((a) => a.ruleId !== ruleId);
		this.puzzle.localRules = this.puzzle.localRules.filter((inst) => inst.ruleId !== ruleId);
		this.syncEffectiveGlobalRules();
	}

	// ---- Apply solver results ----

	applySolution(solution: Record<string, unknown>): void {
		this.pushHistory();
		const spaces = buildVariableSpaces(this.puzzle);

		// Clear all non-given data first
		for (const sp of spaces) {
			for (let r = 0; r < sp.numRows; r++) {
				for (let c = 0; c < sp.numCols; c++) {
					sp.clearValue(r, c);
				}
			}
		}

		// Apply solution values to non-given positions
		for (const sp of spaces) {
			const data = solution[sp.solField] as (number | boolean)[][] | undefined;
			if (!data) continue;
			for (let r = 0; r < Math.min(sp.numRows, data.length); r++) {
				for (let c = 0; c < Math.min(sp.numCols, data[r]?.length ?? 0); c++) {
					if (sp.getGiven(r, c) === undefined) {
						sp.applyValue(r, c, data[r][c]);
					}
				}
			}
		}
	}

	applyCandidates(candidates: CandidateResult): void {
		this.pushHistory();
		const spaces = buildVariableSpaces(this.puzzle);

		// Clear all non-given values first
		for (const sp of spaces) {
			for (let r = 0; r < sp.numRows; r++) {
				for (let c = 0; c < sp.numCols; c++) {
					sp.clearValue(r, c);
				}
			}
		}

		// Apply candidates: single value → fill, multiple → pencil marks
		for (const sp of spaces) {
			const data = candidates.grids[sp.solField] as unknown[][] | undefined;
			if (!data) continue;
			for (let r = 0; r < Math.min(sp.numRows, data.length); r++) {
				for (let c = 0; c < Math.min(sp.numCols, data[r]?.length ?? 0); c++) {
					if (sp.getGiven(r, c) !== undefined) continue;
					const val = data[r][c];
					if (sp.resultKind === 'numeric') {
						const marks = val as number[];
						if (marks.length === 1) {
							sp.applyValue(r, c, marks[0]);
						} else if (marks.length > 1) {
							sp.applyMarks(r, c, marks);
						}
					} else {
						// boolean: 'true'/'false' → apply, 'both'/null → skip
						if (val === 'true') sp.applyValue(r, c, true);
						else if (val === 'false') sp.applyValue(r, c, false);
					}
				}
			}
		}
	}

	// ---- Serialization ----

	exportJSON(): string {
		return JSON.stringify({
			...$state.snapshot(this.puzzle),
			favoriteRules: [...ui.favoriteRules],
		}, null, 2);
	}

	importJSON(json: string): void {
		const parsed = JSON.parse(json) as Record<string, unknown> & { favoriteRules?: string[] };
		const { favoriteRules, ...raw } = parsed;
		const state = migratePuzzleJSON(raw);
		this.loadPuzzle(state);
		if (Array.isArray(favoriteRules)) {
			ui.favoriteRules = new Set(favoriteRules);
		}
		if (ui.mode === 'grid-setup' || ui.mode === 'region-edit' || ui.mode === 'quickstart') {
			ui.setMode('setting');
		}
	}

	getCell(row: number, col: number): CellValue {
		return this.puzzle.cells[row][col];
	}
}

export const puzzleStore = new PuzzleStore();
