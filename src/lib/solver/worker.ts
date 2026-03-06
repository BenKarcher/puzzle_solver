import * as MiniZinc from 'minizinc';
import type { SolutionMessage, SolveProgress, SolveResult } from 'minizinc';

let initialized = false;

export async function initSolver(): Promise<void> {
	if (initialized) return;
	const base = window.location.origin;
	await MiniZinc.init({
		workerURL: `${base}/minizinc-worker.js`,
		wasmURL: `${base}/minizinc.wasm`,
		dataURL: `${base}/minizinc.data`
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
	callbacks?: SolveCallbacks
): Promise<SolveHandle> {
	await initSolver();

	const model = new MiniZinc.Model();
	model.addString(mznSource);

	const solveProgress: SolveProgress = model.solve({
		options: { solver: 'gecode' }
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
	callbacks?: SolveCallbacks
): Promise<SolveAllHandle> {
	await initSolver();

	const model = new MiniZinc.Model();
	model.addString(mznSource);

	let count = 0;

	const solveProgress: SolveProgress = model.solve({
		options: {
			solver: 'gecode',
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
export async function checkSatisfiable(mznSource: string): Promise<boolean> {
	await initSolver();

	const model = new MiniZinc.Model();
	model.addString(mznSource);

	const result: SolveResult = await model.solve({
		options: { solver: 'gecode' }
	});

	return result.status === 'SATISFIED' || result.status === 'ALL_SOLUTIONS' || result.status === 'OPTIMAL_SOLUTION';
}
