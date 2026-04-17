import { nanoid } from 'nanoid';
import type {
	CellCoord,
	CellValue,
	CustomRuleDefinition,
	EdgeCoord,
	EdgeValue,
	PuzzleState,
	RuleGroup,
	RuleInstance,
	SolutionSpaces
} from '$lib/model/types';
import {
	createBlankPuzzle,
	createDefaultCell,
	resizePuzzle
} from '$lib/model/defaults';
import type { CandidateResult } from '$lib/solver/candidates';
import { buildVariableSpaces } from '$lib/solver/variable-spaces';
import { history } from './history.svelte';
import { getRuleById } from '$lib/rules/registry';
import { ui } from './ui.svelte';

class PuzzleStore {
	puzzle = $state<PuzzleState>(createBlankPuzzle(9, 9));

	get rows(): number {
		return this.puzzle.dimensions.rows;
	}

	get cols(): number {
		return this.puzzle.dimensions.cols;
	}

	private pushHistory(): void {
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
		history.clear();
		history.push(structuredClone($state.snapshot(this.puzzle)));
		ui.autoFavoriteUsedRules(state.globalRules, state.localRules);
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

	// ---- Solution spaces ----

	updateSolutionSpaces(spaces: Partial<SolutionSpaces>): void {
		this.pushHistory();
		const prev = this.puzzle.solutionSpaces;
		this.puzzle.solutionSpaces = { ...prev, ...spaces };

		// Clear cell data when a solution space is disabled
		const { rows, cols } = this.puzzle.dimensions;

		if (spaces.numbers && !spaces.numbers.enabled && prev.numbers.enabled) {
			for (let r = 0; r < rows; r++) {
				for (let c = 0; c < cols; c++) {
					const cell = this.puzzle.cells[r][c];
					cell.number = null;
					cell.numberIsGiven = false;
					cell.pencilMarks = [];
				}
			}
		}

		if (spaces.shading && !spaces.shading.enabled && prev.shading.enabled) {
			for (let r = 0; r < rows; r++) {
				for (let c = 0; c < cols; c++) {
					const cell = this.puzzle.cells[r][c];
					cell.shaded = null;
					cell.shadedIsGiven = false;
				}
			}
		}

		if (spaces.borders && !spaces.borders.enabled && prev.borders.enabled) {
			for (const edgeRow of this.puzzle.hEdges) {
				for (const edge of edgeRow) {
					edge.border = null;
					edge.borderIsGiven = false;
				}
			}
			for (const edgeRow of this.puzzle.vEdges) {
				for (const edge of edgeRow) {
					edge.border = null;
					edge.borderIsGiven = false;
				}
			}
		}

		if (spaces.lines && !spaces.lines.enabled && prev.lines.enabled) {
			for (const edgeRow of this.puzzle.hEdges) {
				for (const edge of edgeRow) {
					edge.lines = null;
					edge.lineIsGiven = false;
				}
			}
			for (const edgeRow of this.puzzle.vEdges) {
				for (const edge of edgeRow) {
					edge.lines = null;
					edge.lineIsGiven = false;
				}
			}
		}
	}

	// ---- Cell mutations ----

	setCellNumber(coord: CellCoord, value: number | null, isGiven: boolean): void {
		this.pushHistory();
		const cell = this.puzzle.cells[coord.row][coord.col];
		cell.number = value;
		cell.numberIsGiven = isGiven;
		cell.pencilMarks = [];
	}

	setCellShading(coord: CellCoord, value: boolean | null, isGiven: boolean): void {
		this.pushHistory();
		const cell = this.puzzle.cells[coord.row][coord.col];
		cell.shaded = value;
		// Clearing shading (null) means there's no given to preserve
		cell.shadedIsGiven = value !== null && isGiven;
	}

	toggleCellShading(coord: CellCoord, isGiven: boolean): void {
		const cell = this.puzzle.cells[coord.row][coord.col];
		if (cell.shaded === true) {
			this.setCellShading(coord, false, isGiven);
		} else if (cell.shaded === false) {
			this.setCellShading(coord, null, isGiven);
		} else {
			this.setCellShading(coord, true, isGiven);
		}
	}

	togglePencilMark(coord: CellCoord, value: number): void {
		this.pushHistory();
		const cell = this.puzzle.cells[coord.row][coord.col];
		const idx = cell.pencilMarks.indexOf(value);
		if (idx >= 0) {
			cell.pencilMarks = cell.pencilMarks.filter((v) => v !== value);
		} else {
			cell.pencilMarks = [...cell.pencilMarks, value].sort((a, b) => a - b);
		}
	}

	setRegionId(coord: CellCoord, id: number): void {
		this.pushHistory();
		this.puzzle.cells[coord.row][coord.col].regionId = id;
	}

	clearCell(coord: CellCoord): void {
		this.pushHistory();
		const cell = this.puzzle.cells[coord.row][coord.col];
		cell.number = null;
		cell.numberIsGiven = false;
		cell.shaded = null;
		cell.shadedIsGiven = false;
		cell.pencilMarks = [];
	}

	// ---- Edge mutations ----

	getEdge(coord: EdgeCoord): EdgeValue | null {
		if (coord.direction === 'h') {
			return this.puzzle.hEdges[coord.row]?.[coord.col] ?? null;
		}
		return this.puzzle.vEdges[coord.row]?.[coord.col] ?? null;
	}

	setEdgeBorder(coord: EdgeCoord, value: boolean | null, isGiven: boolean): void {
		this.pushHistory();
		const edge = this.getEdge(coord);
		if (!edge) return;
		edge.border = value;
		edge.borderIsGiven = value !== null && isGiven;
	}

	setEdgeLines(coord: EdgeCoord, value: number | null, isGiven: boolean): void {
		this.pushHistory();
		const edge = this.getEdge(coord);
		if (!edge) return;
		edge.lines = value;
		edge.lineIsGiven = value !== null && isGiven;
	}

	incrementEdgeLines(coord: EdgeCoord, maxLines: number, isGiven: boolean): void {
		const edge = this.getEdge(coord);
		if (!edge) return;
		// null → 1 → 2 → ... → max → null
		const current = edge.lines ?? 0;
		const newValue = current >= maxLines ? null : current + 1;
		this.setEdgeLines(coord, newValue, isGiven);
	}

	/** Clear only non-given data from a cell (for solving mode delete) */
	clearNonGivens(coord: CellCoord): void {
		this.pushHistory();
		const cell = this.puzzle.cells[coord.row][coord.col];
		if (!cell.numberIsGiven) {
			cell.number = null;
			cell.pencilMarks = [];
		}
		if (!cell.shadedIsGiven) {
			cell.shaded = null;
		}
	}

	// ---- Batch operations for solving mode ----

	clearSolveEntries(): void {
		this.pushHistory();
		for (let r = 0; r < this.rows; r++) {
			for (let c = 0; c < this.cols; c++) {
				const cell = this.puzzle.cells[r][c];
				if (!cell.numberIsGiven) {
					cell.number = null;
					cell.pencilMarks = [];
				}
				if (!cell.shadedIsGiven) {
					cell.shaded = null;
				}
			}
		}
		for (const edgeRow of this.puzzle.hEdges) {
			for (const edge of edgeRow) {
				if (!edge.borderIsGiven) edge.border = null;
				if (!edge.lineIsGiven) { edge.lines = null; edge.linePencilMarks = []; }
			}
		}
		for (const edgeRow of this.puzzle.vEdges) {
			for (const edge of edgeRow) {
				if (!edge.borderIsGiven) edge.border = null;
				if (!edge.lineIsGiven) { edge.lines = null; edge.linePencilMarks = []; }
			}
		}
	}

	// ---- Global rules ----

	toggleGlobalRule(ruleId: string): void {
		this.pushHistory();
		const idx = this.puzzle.globalRules.indexOf(ruleId);
		if (idx >= 0) {
			this.puzzle.globalRules = this.puzzle.globalRules.filter((id) => id !== ruleId);
		} else {
			this.puzzle.globalRules = [...this.puzzle.globalRules, ruleId];
		}
	}

	// ---- Local rules ----

	addRuleInstance(ruleId: string, groupCount: number): string {
		this.pushHistory();
		const id = nanoid();
		const groups: RuleGroup[] = Array.from({ length: groupCount }, () => ({
			cells: [],
			value: null
		}));
		const instance: RuleInstance = { ruleId, id, groups };
		this.puzzle.localRules = [...this.puzzle.localRules, instance];
		return id;
	}

	removeRuleInstance(instanceId: string): void {
		this.pushHistory();
		this.puzzle.localRules = this.puzzle.localRules.filter((r) => r.id !== instanceId);
	}

	addCellToGroup(instanceId: string, groupIndex: number, coord: CellCoord): void {
		const instance = this.puzzle.localRules.find((r) => r.id === instanceId);
		if (!instance) return;
		const group = instance.groups[groupIndex];
		if (!group) return;
		const exists = group.cells.some((c) => c.row === coord.row && c.col === coord.col);
		if (exists) return;
		// Enforce maxSize if the rule config specifies one
		const rule = getRuleById(instance.ruleId);
		const maxSize = rule?.config.groups?.constraints.maxSize;
		if (maxSize !== null && maxSize !== undefined && group.cells.length >= maxSize) return;
		this.pushHistory();
		group.cells = [...group.cells, { ...coord }];
	}

	removeCellFromGroup(instanceId: string, groupIndex: number, coord: CellCoord): void {
		this.pushHistory();
		const instance = this.puzzle.localRules.find((r) => r.id === instanceId);
		if (!instance) return;
		const group = instance.groups[groupIndex];
		if (!group) return;
		group.cells = group.cells.filter((c) => c.row !== coord.row || c.col !== coord.col);
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

	// ---- Custom rules ----

	addCustomRule(rule: CustomRuleDefinition): void {
		this.pushHistory();
		this.puzzle.customRules = [...this.puzzle.customRules, rule];
		// Auto-enable global custom rules
		if (rule.scope === 'global') {
			this.puzzle.globalRules = [...this.puzzle.globalRules, rule.id];
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
		this.puzzle.globalRules = this.puzzle.globalRules.filter((id) => id !== ruleId);
		this.puzzle.localRules = this.puzzle.localRules.filter((inst) => inst.ruleId !== ruleId);
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
			const data = candidates[sp.resultField] as unknown[][] | undefined;
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
		const parsed = JSON.parse(json) as PuzzleState & { favoriteRules?: string[] };
		const { favoriteRules, ...state } = parsed;
		// Backward compatibility: older saves may lack customRules
		if (!state.customRules) state.customRules = [];
		// Backward compatibility: older saves may lack the modifiers solution space
		if (!state.solutionSpaces.modifiers) {
			state.solutionSpaces.modifiers = { enabled: false, min: 1, max: 18 };
		}
		// Backward compatibility: legacy 'numbers' tag in custom rules → ['digits', 'values']
		for (const cr of state.customRules) {
			const rs = cr.requiredSpaces as string[];
			if (rs.includes('numbers')) {
				cr.requiredSpaces = rs.flatMap((s) =>
					s === 'numbers' ? ['digits', 'values'] : [s]
				) as typeof cr.requiredSpaces;
			}
		}
		// Backward compatibility: older saves may lack linePencilMarks on edges
		for (const edgeRow of state.hEdges) {
			for (const edge of edgeRow) {
				if (!edge.linePencilMarks) edge.linePencilMarks = [];
			}
		}
		for (const edgeRow of state.vEdges) {
			for (const edge of edgeRow) {
				if (!edge.linePencilMarks) edge.linePencilMarks = [];
			}
		}
		this.loadPuzzle(state);
		if (Array.isArray(favoriteRules)) {
			ui.favoriteRules = new Set(favoriteRules);
		}
		if (ui.mode === 'grid-setup' || ui.mode === 'region-edit') {
			ui.setMode('setting');
		}
	}

	getCell(row: number, col: number): CellValue {
		return this.puzzle.cells[row][col];
	}
}

export const puzzleStore = new PuzzleStore();
