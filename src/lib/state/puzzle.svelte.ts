import { nanoid } from 'nanoid';
import type {
	CellCoord,
	CellValue,
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
import { history } from './history.svelte';
import { getRuleById } from '$lib/rules/registry';

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
		this.puzzle.solutionSpaces = { ...this.puzzle.solutionSpaces, ...spaces };
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
		cell.shadedIsGiven = isGiven;
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

	// ---- Serialization ----

	exportJSON(): string {
		return JSON.stringify($state.snapshot(this.puzzle), null, 2);
	}

	importJSON(json: string): void {
		const state = JSON.parse(json) as PuzzleState;
		this.loadPuzzle(state);
	}

	getCell(row: number, col: number): CellValue {
		return this.puzzle.cells[row][col];
	}
}

export const puzzleStore = new PuzzleStore();
