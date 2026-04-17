import * as MiniZinc from 'minizinc';
import type { SolutionMessage, SolveProgress, SolveResult } from 'minizinc';
import { base } from '$app/paths';

let initialized = false;

export async function initSolver(): Promise<void> {
	if (initialized) return;
	const origin = window.location.origin;
	await MiniZinc.init({
		workerURL: `${origin}${base}/minizinc-worker.js`,
		wasmURL: `${origin}${base}/minizinc.wasm`,
		dataURL: `${origin}${base}/minizinc.data`
	});
	initialized = true;
}

export interface SolveCallbacks {
	onSolution?: (solution: Record<string, unknown>) => void;
	onStatus?: (status: string) => void;
	onError?: (error: string) => void;
}

export interface SolveHandle {
	promise: Promise<Record<string, unknown> | null>;
	cancel: () => void;
}

export interface SolveAllHandle {
	promise: Promise<number>;
	cancel: () => void;
}

/**
 * Wrap solveProgress so that the returned promise resolves only AFTER
 * all queued 'solution' events have been delivered.  MiniZinc's WASM
 * bridge can resolve the thenable before flushing solution messages.
 */
function wrapSolveProgress<T>(
	solveProgress: SolveProgress,
	onSolution: (e: SolutionMessage) => void,
	onComplete: (result: SolveResult) => T
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		solveProgress.on('solution', onSolution);

		Promise.resolve(solveProgress).then((result: SolveResult) => {
			// Yield to the event loop so any remaining solution messages
			// that arrived in the same microtask batch get processed first.
			setTimeout(() => {
				try {
					resolve(onComplete(result));
				} catch (e) {
					reject(e);
				}
			}, 0);
		}, reject);
	});
}

/**
 * Solve a MiniZinc model string. Returns a cancellable handle.
 */
export async function solve(
	mznSource: string,
	callbacks?: SolveCallbacks,
	solver: string = 'gecode'
): Promise<SolveHandle> {
	await initSolver();

	const model = new MiniZinc.Model();
	model.addString(mznSource);

	const solveProgress: SolveProgress = model.solve({
		options: { solver }
	});

	let lastSolution: Record<string, unknown> | null = null;

	const promise = wrapSolveProgress(
		solveProgress,
		(e: SolutionMessage) => {
			if (e.output?.json) {
				lastSolution = e.output.json;
				callbacks?.onSolution?.(e.output.json);
			}
		},
		(result: SolveResult) => {
			callbacks?.onStatus?.(result.status);
			return lastSolution;
		}
	);

	return {
		promise,
		cancel: () => solveProgress.cancel()
	};
}

/**
 * Find all solutions to a MiniZinc model. Returns a cancellable handle.
 */
export async function solveAll(
	mznSource: string,
	callbacks?: SolveCallbacks,
	solver: string = 'gecode'
): Promise<SolveAllHandle> {
	await initSolver();

	const model = new MiniZinc.Model();
	model.addString(mznSource);

	let count = 0;

	const solveProgress: SolveProgress = model.solve({
		options: {
			solver,
			'all-solutions': true
		}
	});

	const promise = wrapSolveProgress(
		solveProgress,
		(e: SolutionMessage) => {
			count++;
			if (e.output?.json && callbacks?.onSolution) {
				callbacks.onSolution(e.output.json);
			}
		},
		(result: SolveResult) => {
			callbacks?.onStatus?.(result.status);
			return count;
		}
	);

	return {
		promise,
		cancel: () => solveProgress.cancel()
	};
}

/**
 * Check if a particular assignment is satisfiable.
 */
export async function checkSatisfiable(mznSource: string, solver: string = 'gecode'): Promise<boolean> {
	await initSolver();

	const model = new MiniZinc.Model();
	model.addString(mznSource);

	const result: SolveResult = await model.solve({
		options: { solver }
	});

	return result.status === 'SATISFIED' || result.status === 'ALL_SOLUTIONS' || result.status === 'OPTIMAL_SOLUTION';
}

/**
 * Solve and return the solution if SAT, or null if UNSAT.
 */
export async function solveForSolution(
	mznSource: string,
	solver: string = 'gecode',
	onStats?: (stats: Record<string, unknown>) => void
): Promise<Record<string, unknown> | null> {
	await initSolver();

	const model = new MiniZinc.Model();
	model.addString(mznSource);

	let solution: Record<string, unknown> | null = null;

	const promise = wrapSolveProgress(
		model.solve({ options: { solver, statistics: !!onStats } }),
		(e: SolutionMessage) => {
			if (e.output?.json) solution = e.output.json;
		},
		(result) => {
			if (onStats && result.statistics) onStats(result.statistics);
			return solution;
		}
	);

	return promise;
}

/**
 * Run solveAll with a time limit, calling onSolution for each solution found.
 * Returns whether enumeration completed and how many solutions were found.
 */
export async function solveAllTimed(
	mznSource: string,
	timeLimitMs: number,
	onSolution: (sol: Record<string, unknown>) => void,
	solver: string = 'gecode',
	signal?: AbortSignal,
	onStats?: (stats: Record<string, unknown>) => void
): Promise<{ completed: boolean; count: number }> {
	await initSolver();

	const model = new MiniZinc.Model();
	model.addString(mznSource);

	let count = 0;

	const solveProgress: SolveProgress = model.solve({
		options: {
			solver,
			'all-solutions': true,
			'time-limit': timeLimitMs,
			statistics: !!onStats
		}
	});

	// Hard wall-clock timeout — MiniZinc WASM time-limit can be unreliable
	const timer = setTimeout(() => solveProgress.cancel(), timeLimitMs + 500);

	if (signal) {
		signal.addEventListener('abort', () => solveProgress.cancel(), { once: true });
	}

	let result: SolveResult;
	try {
		result = await wrapSolveProgress(
			solveProgress,
			(e: SolutionMessage) => {
				count++;
				if (e.output?.json) onSolution(e.output.json);
			},
			(r: SolveResult) => {
				if (onStats && r.statistics) onStats(r.statistics);
				return r;
			}
		);
	} catch {
		// WASM can throw on cancel — treat as timed out
		return { completed: false, count };
	} finally {
		clearTimeout(timer);
	}

	const completed = result.status === 'ALL_SOLUTIONS' || result.status === 'OPTIMAL_SOLUTION';
	return { completed, count };
}

/**
 * Run true-candidates computation natively in Chuffed.
 * The solver internally tracks candidate sets and posts novelty clauses,
 * emitting each distinct solution as it's found. Terminates when all
 * candidates are resolved or UNSAT.
 */
export async function solveTrueCandidates(
	mznSource: string,
	onSolution: (sol: Record<string, unknown>) => void,
	signal?: AbortSignal
): Promise<{ completed: boolean; count: number }> {
	await initSolver();

	const model = new MiniZinc.Model();
	model.addString(mznSource);

	let count = 0;

	const solveProgress: SolveProgress = model.solve({
		options: {
			solver: 'chuffed',
			'true-candidates': true,
		}
	});

	if (signal) {
		signal.addEventListener('abort', () => solveProgress.cancel(), { once: true });
	}

	let result: SolveResult;
	try {
		result = await wrapSolveProgress(
			solveProgress,
			(e: SolutionMessage) => {
				count++;
				if (e.output?.json) onSolution(e.output.json);
			},
			(r: SolveResult) => r
		);
	} catch {
		return { completed: false, count };
	}

	const completed = result.status === 'ALL_SOLUTIONS' || result.status === 'OPTIMAL_SOLUTION'
		|| result.status === 'SATISFIED';
	return { completed, count };
}


