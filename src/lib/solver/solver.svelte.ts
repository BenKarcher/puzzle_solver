import type { PuzzleState, LoadedRule } from '$lib/model/types';
import { compilePuzzle } from './compiler';
import { solve, solveAll } from './worker';
import { findTrueCandidates, type CandidateResult, type CandidateProgress } from './candidates';

export type SolverStatus = 'idle' | 'compiling' | 'solving' | 'done' | 'error';

class SolverStore {
	// Reactive state (drives UI)
	status = $state<SolverStatus>('idle');
	solutions = $state<Record<string, unknown>[]>([]);
	currentSolutionIndex = $state(0);
	totalSolutionCount = $state(0);
	maxStoredSolutions = $state(200);
	errorMessage = $state<string | null>(null);
	candidateResult = $state<CandidateResult | null>(null);
	candidateProgress = $state<CandidateProgress | null>(null);
	compiledModel = $state<string | null>(null);

	// Non-reactive internals for solveAll buffering
	private cancelFn: (() => void) | null = null;
	private _count = 0;
	private _stored: Record<string, unknown>[] = [];
	private _ticker: ReturnType<typeof setInterval> | null = null;

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
		this._count = 0;
		this._stored = [];
		this.status = 'idle';
		this.solutions = [];
		this.currentSolutionIndex = 0;
		this.totalSolutionCount = 0;
		this.errorMessage = null;
		this.candidateResult = null;
		this.candidateProgress = null;
		this.compiledModel = null;
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
			});
			this.cancelFn = handle.cancel;

			await handle.promise;
			this.cancelFn = null;

			if (this.solutions.length === 0) {
				this.errorMessage = 'No solution found (unsatisfiable)';
			}
			this.status = 'done';
		} catch (e) {
			this.cancelFn = null;
			if (this.status === 'done') return;
			this.status = 'error';
			this.errorMessage = e instanceof Error ? e.message : String(e);
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

			// Start periodic UI sync
			this.startTicker();

			const handle = await solveAll(mzn, {
				onSolution: (sol) => {
					this._count++;
					if (this._stored.length < max) {
						this._stored.push(sol);
					}
				}
			});
			this.cancelFn = handle.cancel;

			await handle.promise;
			this.cancelFn = null;
			this.stopTicker();
			this.syncToReactive();

			this.status = 'done';
			if (this.totalSolutionCount === 0) {
				this.errorMessage = 'No solution found (unsatisfiable)';
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
				this.errorMessage = e instanceof Error ? e.message : String(e);
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
			}, controller.signal);
			this.cancelFn = null;
			this.candidateResult = result;
			this.status = 'done';
		} catch (e) {
			this.cancelFn = null;
			if (this.status === 'done') return;
			if (e instanceof DOMException && e.name === 'AbortError') {
				this.status = 'done';
				return;
			}
			this.status = 'error';
			this.errorMessage = e instanceof Error ? e.message : String(e);
		}
	}

	nextSolution(): void {
		if (this.currentSolutionIndex < this.solutions.length - 1) {
			this.currentSolutionIndex++;
		}
	}

	prevSolution(): void {
		if (this.currentSolutionIndex > 0) {
			this.currentSolutionIndex--;
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
