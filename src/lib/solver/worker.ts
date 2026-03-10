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
	solver: string = 'gecode'
): Promise<Record<string, unknown> | null> {
	await initSolver();

	const model = new MiniZinc.Model();
	model.addString(mznSource);

	let solution: Record<string, unknown> | null = null;

	const promise = wrapSolveProgress(
		model.solve({ options: { solver } }),
		(e: SolutionMessage) => {
			if (e.output?.json) solution = e.output.json;
		},
		() => solution
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
	signal?: AbortSignal
): Promise<{ completed: boolean; count: number }> {
	await initSolver();

	const model = new MiniZinc.Model();
	model.addString(mznSource);

	let count = 0;

	const solveProgress: SolveProgress = model.solve({
		options: {
			solver,
			'all-solutions': true,
			'time-limit': timeLimitMs
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
		// WASM can throw on cancel — treat as timed out
		return { completed: false, count };
	}

	const completed = result.status === 'ALL_SOLUTIONS' || result.status === 'OPTIMAL_SOLUTION';
	return { completed, count };
}

/**
 * Run isolated diagnostics to identify which MiniZinc features work in WASM.
 */
export async function runDiagnostics(baseModel: string, solver: string = 'gecode'): Promise<void> {
	await initSolver();

	const tests: { name: string; run: () => Promise<string> }[] = [];

	// Test 1: Basic solve
	tests.push({
		name: 'basic solve',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString(baseModel);
			const result: SolveResult = await model.solve({ options: { solver } });
			return `status=${result.status}`;
		}
	});

	// Test 2: all-solutions (no time limit)
	tests.push({
		name: 'all-solutions (no time limit)',
		run: async () => {
			const model = new MiniZinc.Model();
			// Use a tiny model so it finishes fast
			model.addString('var 1..3: x;\nsolve satisfy;\n');
			let count = 0;
			const result = await wrapSolveProgress(
				model.solve({ options: { solver, 'all-solutions': true } }),
				() => { count++; },
				(r: SolveResult) => r
			);
			return `status=${result.status}, count=${count}`;
		}
	});

	// Test 3: all-solutions with time-limit
	tests.push({
		name: 'all-solutions + time-limit',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString('var 1..3: x;\nsolve satisfy;\n');
			let count = 0;
			const result = await wrapSolveProgress(
				model.solve({ options: { solver, 'all-solutions': true, 'time-limit': 5000 } }),
				() => { count++; },
				(r: SolveResult) => r
			);
			return `status=${result.status}, count=${count}`;
		}
	});

	// Test 4: search annotation (int_search with indomain_random)
	tests.push({
		name: 'int_search + indomain_random',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString('var 1..3: x;\nsolve :: int_search([x], input_order, indomain_random) satisfy;\n');
			const result: SolveResult = await model.solve({ options: { solver } });
			return `status=${result.status}`;
		}
	});

	// Test 5: bool_search with indomain_random
	tests.push({
		name: 'bool_search + indomain_random',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString('var bool: x;\nsolve :: bool_search([x], input_order, indomain_random) satisfy;\n');
			const result: SolveResult = await model.solve({ options: { solver } });
			return `status=${result.status}`;
		}
	});

	// Test 6: seq_search
	tests.push({
		name: 'seq_search',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString('var 1..3: x;\nvar bool: b;\nsolve :: seq_search([int_search([x], input_order, indomain_random), bool_search([b], input_order, indomain_random)]) satisfy;\n');
			const result: SolveResult = await model.solve({ options: { solver } });
			return `status=${result.status}`;
		}
	});

	// Test 7: solveForSolution (wrapper function)
	tests.push({
		name: 'solveForSolution',
		run: async () => {
			const sol = await solveForSolution('var 1..3: x;\nsolve satisfy;\n', solver);
			return sol ? `got solution: x=${(sol as Record<string, unknown>).x}` : 'null';
		}
	});

	// Test 8: OR constraint
	tests.push({
		name: 'OR constraint',
		run: async () => {
			const sol = await solveForSolution(
				'var 1..3: x;\nvar 1..3: y;\nconstraint (x = 2) \\/ (y = 3);\nsolve satisfy;\n',
				solver
			);
			return sol ? `x=${(sol as Record<string, unknown>).x}, y=${(sol as Record<string, unknown>).y}` : 'null';
		}
	});

	// Test 9: all-solutions + time-limit on the actual base model
	tests.push({
		name: 'base model + all-solutions + time-limit',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString(baseModel);
			let count = 0;
			const result = await wrapSolveProgress(
				model.solve({ options: { solver, 'all-solutions': true, 'time-limit': 2000 } }),
				(e: SolutionMessage) => { count++; },
				(r: SolveResult) => r
			);
			return `status=${result.status}, count=${count}`;
		}
	});

	// Test 10: random search on base model
	tests.push({
		name: 'base model + random search annotation',
		run: async () => {
			const withoutSolve = baseModel.replace(/\nsolve[^;]*;\s*$/, '\n');
			const randomModel = withoutSolve + 'solve :: int_search([x | x in array1d(grid)], first_fail, indomain_random) satisfy;\n';
			const model = new MiniZinc.Model();
			model.addString(randomModel);
			const result: SolveResult = await model.solve({ options: { solver } });
			return `status=${result.status}`;
		}
	});

	// --- Chuffed-specific search annotations ---

	// Test 11: random_order variable selection (Chuffed-specific)
	tests.push({
		name: 'int_search + random_order + indomain_min',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString('var 1..3: x;\nvar 1..3: y;\nsolve :: int_search([x,y], random_order, indomain_min) satisfy;\n');
			const result: SolveResult = await model.solve({ options: { solver } });
			return `status=${result.status}`;
		}
	});

	// Test 12: random_order + indomain_random (both random)
	tests.push({
		name: 'int_search + random_order + indomain_random',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString('var 1..3: x;\nvar 1..3: y;\nsolve :: int_search([x,y], random_order, indomain_random) satisfy;\n');
			const result: SolveResult = await model.solve({ options: { solver } });
			return `status=${result.status}`;
		}
	});

	// Test 13: indomain_max (standard, for diversity passes)
	tests.push({
		name: 'int_search + first_fail + indomain_max',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString('var 1..3: x;\nvar 1..3: y;\nsolve :: int_search([x,y], first_fail, indomain_max) satisfy;\n');
			const result: SolveResult = await model.solve({ options: { solver } });
			return `status=${result.status}`;
		}
	});

	// Test 14: indomain_median
	tests.push({
		name: 'int_search + first_fail + indomain_median',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString('var 1..3: x;\nvar 1..3: y;\nsolve :: int_search([x,y], first_fail, indomain_median) satisfy;\n');
			const result: SolveResult = await model.solve({ options: { solver } });
			return `status=${result.status}`;
		}
	});

	// Test 15: largest_smallest variable selection (Chuffed-specific)
	tests.push({
		name: 'int_search + largest_smallest + indomain_min',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString('var 1..3: x;\nvar 1..3: y;\nsolve :: int_search([x,y], largest_smallest, indomain_min) satisfy;\n');
			const result: SolveResult = await model.solve({ options: { solver } });
			return `status=${result.status}`;
		}
	});

	// Test 16: smallest_largest variable selection (Chuffed-specific)
	tests.push({
		name: 'int_search + smallest_largest + indomain_min',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString('var 1..3: x;\nvar 1..3: y;\nsolve :: int_search([x,y], smallest_largest, indomain_min) satisfy;\n');
			const result: SolveResult = await model.solve({ options: { solver } });
			return `status=${result.status}`;
		}
	});

	// Test 17: num-solutions option (large domain to distinguish working vs ignored)
	tests.push({
		name: 'all-solutions + num-solutions=2 (domain 1..100)',
		run: async () => {
			const model = new MiniZinc.Model();
			model.addString('var 1..100: x;\nsolve satisfy;\n');
			let count = 0;
			const result = await wrapSolveProgress(
				model.solve({ options: { solver, 'all-solutions': true, 'num-solutions': 2 } }),
				() => { count++; },
				(r: SolveResult) => r
			);
			return `status=${result.status}, count=${count} (expect ~2 if working, 100 if ignored)`;
		}
	});

	// Test 18: random_order on base model (Chuffed-specific)
	tests.push({
		name: 'base model + random_order',
		run: async () => {
			const withoutSolve = baseModel.replace(/\nsolve[^;]*;\s*$/, '\n');
			const randomModel = withoutSolve + 'solve :: int_search([x | x in array1d(grid)], random_order, indomain_min) satisfy;\n';
			const model = new MiniZinc.Model();
			model.addString(randomModel);
			const result: SolveResult = await model.solve({ options: { solver } });
			return `status=${result.status}`;
		}
	});

	// Run all tests
	console.log(`=== MiniZinc WASM Diagnostics (solver: ${solver}) ===`);
	for (const test of tests) {
		try {
			const result = await test.run();
			console.log(`  PASS: ${test.name} → ${result}`);
		} catch (e) {
			console.error(`  FAIL: ${test.name} → ${e}`);
		}
	}
	console.log('=== Diagnostics Complete ===');
}
