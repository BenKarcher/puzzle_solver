import type { PuzzleState, LoadedRule, CellCoord } from '$lib/model/types';
import { compilePuzzle, compilePuzzleForCheck } from './compiler';
import { solve, solveAll, checkSatisfiable } from './worker';
import { findTrueCandidates, type CandidateResult, type CandidateProgress } from './candidates';
import { solutionKey } from './variable-spaces';
import { puzzleStore } from '$lib/state/puzzle.svelte';

export interface CheckResult {
	status: 'correct' | 'incomplete' | 'incorrect';
	message: string;
	violations: { ruleName: string; cells: CellCoord[] }[];
}

export type SolverStatus = 'idle' | 'compiling' | 'solving' | 'done' | 'error';

function formatError(e: unknown): string {
	if (e instanceof Error) return e.message;
	if (typeof e === 'object' && e !== null) {
		// MiniZinc WASM may throw plain objects with message or error fields
		const obj = e as Record<string, unknown>;
		if (typeof obj.message === 'string') return obj.message;
		if (typeof obj.error === 'string') return obj.error;
		return JSON.stringify(e);
	}
	return String(e);
}

export const AVAILABLE_SOLVERS = [
	{ id: 'gecode', name: 'Gecode' },
	{ id: 'chuffed', name: 'Chuffed' }
] as const;

class SolverStore {
	// Reactive state (drives UI)
	status = $state<SolverStatus>('idle');
	selectedSolver = $state('chuffed');
	solutions = $state<Record<string, unknown>[]>([]);
	currentSolutionIndex = $state(0);
	totalSolutionCount = $state(0);
	maxStoredSolutions = $state(200);
	errorMessage = $state<string | null>(null);
	candidateResult = $state<CandidateResult | null>(null);
	candidateProgress = $state<CandidateProgress | null>(null);
	compiledModel = $state<string | null>(null);
	checkResult = $state<CheckResult | null>(null);

	// Non-reactive internals for solveAll buffering
	private cancelFn: (() => void) | null = null;
	private _count = 0;
	private _stored: Record<string, unknown>[] = [];
	private _ticker: ReturnType<typeof setInterval> | null = null;
	private _seenKeys: Set<string> | null = null;

	get currentSolution(): Record<string, unknown> | null {
		return this.solutions[this.currentSolutionIndex] ?? null;
	}

	get solutionCount(): number {
		return this.totalSolutionCount;
	}

	// --- Sync buffered data to reactive state ---
	private syncToReactive(): void {
		this.totalSolutionCount = this._count;
		if (this._stored.length > this.solutions.length) {
			this.solutions = [...this._stored];
		}
	}

	private startTicker(): void {
		if (this._ticker) return;
		this._ticker = setInterval(() => this.syncToReactive(), 200);
	}

	private stopTicker(): void {
		if (this._ticker) {
			clearInterval(this._ticker);
			this._ticker = null;
		}
	}

	// --- Public API ---

	clear(): void {
		this.cancel();
		this.stopTicker();
		const hadResults = this._count > 0 || this.candidateResult !== null;
		this._count = 0;
		this._stored = [];
		this._seenKeys = null;
		this.status = 'idle';
		this.solutions = [];
		this.currentSolutionIndex = 0;
		this.totalSolutionCount = 0;
		this.errorMessage = null;
		this.candidateResult = null;
		this.candidateProgress = null;
		this.compiledModel = null;
		this.checkResult = null;
		if (hadResults) {
			puzzleStore.clearSolveEntries();
		}
	}

	cancel(): void {
		if (this.cancelFn) {
			this.cancelFn();
			this.cancelFn = null;
		}
		this.stopTicker();
		this.syncToReactive();
		if (this.status === 'solving' || this.status === 'compiling') {
			this.status = 'done';
		}
	}

	async solvePuzzle(puzzle: PuzzleState, rules: LoadedRule[]): Promise<void> {
		this.clear();
		this.status = 'compiling';

		try {
			const mzn = compilePuzzle(puzzle, rules);
			this.compiledModel = mzn;
			this.status = 'solving';

			const handle = await solve(mzn, {
				onSolution: (sol) => {
					this.solutions = [sol];
					this.totalSolutionCount = 1;
				}
			}, this.selectedSolver);
			this.cancelFn = handle.cancel;

			await handle.promise;
			this.cancelFn = null;

			if (this.solutions.length === 0) {
				this.errorMessage = 'No solution found (unsatisfiable)';
			} else {
				puzzleStore.applySolution(this.solutions[0]);
			}
			this.status = 'done';
		} catch (e) {
			this.cancelFn = null;
			if (this.status === 'done') return;
			this.status = 'error';
			this.errorMessage = formatError(e);
		}
	}

	async solveAllPuzzle(puzzle: PuzzleState, rules: LoadedRule[]): Promise<void> {
		this.clear();
		this.status = 'compiling';

		try {
			const mzn = compilePuzzle(puzzle, rules);
			this.compiledModel = mzn;
			this.status = 'solving';

			const max = this.maxStoredSolutions;
			this._count = 0;
			this._stored = [];
			this._seenKeys = new Set();

			// Start periodic UI sync
			this.startTicker();

			const handle = await solveAll(mzn, {
				onSolution: (sol) => {
					// Deduplicate: auxiliary variables can produce multiple
					// solver solutions with identical decision variable values.
					const key = solutionKey(sol);
					if (this._seenKeys!.has(key)) return;
					this._seenKeys!.add(key);
					this._count++;
					if (this._stored.length < max) {
						this._stored.push(sol);
					}
				}
			}, this.selectedSolver);
			this.cancelFn = handle.cancel;

			await handle.promise;
			this.cancelFn = null;
			this.stopTicker();
			this.syncToReactive();

			this.status = 'done';
			if (this.totalSolutionCount === 0) {
				this.errorMessage = 'No solution found (unsatisfiable)';
			} else if (this.solutions.length > 0) {
				puzzleStore.applySolution(this.solutions[0]);
			}
		} catch (e) {
			this.cancelFn = null;
			this.stopTicker();
			this.syncToReactive();
			if (this.status === 'done') return;
			if (this.totalSolutionCount > 0) {
				this.status = 'done';
			} else {
				this.status = 'error';
				this.errorMessage = formatError(e);
			}
		}
	}

	async findCandidates(puzzle: PuzzleState, rules: LoadedRule[]): Promise<void> {
		this.clear();
		this.status = 'solving';

		const controller = new AbortController();
		this.cancelFn = () => controller.abort();

		try {
			const result = await findTrueCandidates(puzzle, rules, (progress) => {
				this.candidateProgress = { ...progress };
			}, controller.signal, this.selectedSolver);
			this.cancelFn = null;
			this.candidateResult = result;
			puzzleStore.applyCandidates(result);
			this.status = 'done';
		} catch (e) {
			this.cancelFn = null;
			if (this.status === 'done') return;
			if (e instanceof DOMException && e.name === 'AbortError') {
				this.status = 'done';
				return;
			}
			this.status = 'error';
			this.errorMessage = formatError(e);
		}
	}

	async checkSolution(puzzle: PuzzleState, rules: LoadedRule[]): Promise<void> {
		this.checkResult = null;
		const { rows, cols } = puzzle.dimensions;

		// Step 1: Check all number cells are filled
		if (puzzle.solutionSpaces.numbers.enabled) {
			for (let r = 0; r < rows; r++) {
				for (let c = 0; c < cols; c++) {
					if (puzzle.cells[r][c].number === null) {
						this.checkResult = {
							status: 'incomplete',
							message: 'Some numbers have not yet been filled in.',
							violations: []
						};
						return;
					}
				}
			}
		}

		try {
			// Step 2: Check overall satisfiability with user values fixed
			const fullModel = compilePuzzleForCheck(puzzle, rules);
			const sat = await checkSatisfiable(fullModel, this.selectedSolver);

			if (sat) {
				this.checkResult = {
					status: 'correct',
					message: 'The solution is correct!',
					violations: []
				};
				return;
			}

			// Step 3: UNSAT — find which rules are violated
			const violations: CheckResult['violations'] = [];

			// Check each global rule individually
			for (const ruleId of puzzle.globalRules) {
				const rule = rules.find((r) => r.config.id === ruleId);
				if (!rule) continue;

				const testModel = compilePuzzleForCheck(puzzle, rules, new Set([ruleId]));
				const ruleSat = await checkSatisfiable(testModel, this.selectedSolver);
				if (!ruleSat) {
					violations.push({ ruleName: rule.config.name, cells: [] });
				}
			}

			// Check each local rule instance individually
			for (const instance of puzzle.localRules) {
				const rule = rules.find((r) => r.config.id === instance.ruleId);
				if (!rule) continue;

				const testModel = compilePuzzleForCheck(puzzle, rules, undefined, new Set([instance.id]));
				const ruleSat = await checkSatisfiable(testModel, this.selectedSolver);
				if (!ruleSat) {
					const cells = instance.groups.flatMap((g) => g.cells);
					violations.push({ ruleName: rule.config.name, cells });
				}
			}

			// Check custom rules
			for (const customDef of puzzle.customRules) {
				// Custom rules are included via their ID in globalRules or localRules
				// If they're global and already checked above, skip
				if (puzzle.globalRules.includes(customDef.id)) continue;
				// Local custom rules are checked via localRules above
			}

			if (violations.length > 0) {
				const names = violations.map((v) => v.ruleName).join(', ');
				this.checkResult = {
					status: 'incorrect',
					message: `The solution violates: ${names}`,
					violations
				};
			} else {
				// Could be givens or implicit constraints
				this.checkResult = {
					status: 'incorrect',
					message: 'The solution is incorrect.',
					violations: []
				};
			}
		} catch (e) {
			this.checkResult = {
				status: 'incorrect',
				message: `Error checking solution: ${formatError(e)}`,
				violations: []
			};
		}
	}

	nextSolution(): void {
		if (this.currentSolutionIndex < this.solutions.length - 1) {
			this.currentSolutionIndex++;
			puzzleStore.applySolution(this.solutions[this.currentSolutionIndex]);
		}
	}

	prevSolution(): void {
		if (this.currentSolutionIndex > 0) {
			this.currentSolutionIndex--;
			puzzleStore.applySolution(this.solutions[this.currentSolutionIndex]);
		}
	}

	downloadSolutions(): void {
		if (this.solutions.length === 0) return;
		const json = JSON.stringify(this.solutions, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `solutions-${this.solutions.length}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}
}

export const solverStore = new SolverStore();
