import { describe, it, expect } from 'vitest';
import * as MiniZinc from 'minizinc';
import type { SolutionMessage } from 'minizinc';
import { getAllLoadedRules } from '$lib/rules/registry';
import { compilePuzzle, compilePuzzleForCheck } from '$lib/solver/compiler';
import type { PuzzleState } from '$lib/model/types';
import slitherJson from '../../test_puzzles/slither_test.json';
import hashiJson from '../../test_puzzles/hashi_doku.json';

// ── MiniZinc init ─────────────────────────────────────────────────────────────

let mzReady = false;
async function initMZ() {
	if (mzReady) return;
	await MiniZinc.init({
		workerURL: `${location.origin}/minizinc-worker.js`,
		wasmURL:   `${location.origin}/minizinc.wasm`,
		dataURL:   `${location.origin}/minizinc.data`,
	});
	mzReady = true;
}

// ── Solver helpers ────────────────────────────────────────────────────────────

async function satStatus(model: string): Promise<string> {
	await initMZ();
	const m = new MiniZinc.Model();
	m.addFile('puzzle.mzn', model);
	const result = await m.solve({ options: { solver: 'chuffed' } });
	return result.status;
}

/** Solve and return the first solution's output JSON, or null if UNSAT. */
async function firstSolution(model: string): Promise<Record<string, unknown> | null> {
	await initMZ();
	let solution: Record<string, unknown> | null = null;
	const m = new MiniZinc.Model();
	m.addFile('puzzle.mzn', model);
	const progress = m.solve({ options: { solver: 'chuffed' } });
	progress.on('solution', (e: SolutionMessage) => {
		solution = e.output.json as Record<string, unknown>;
	});
	await progress;
	return solution;
}

/**
 * Build a MiniZinc constraint that excludes a specific solution by requiring
 * at least one decision variable to differ from it.
 */
function buildExclusionConstraint(sol: Record<string, unknown>, puzzle: PuzzleState): string {
	const { rows, cols } = puzzle.dimensions;
	const clauses: string[] = [];

	if (puzzle.solutionSpaces.numbers.enabled) {
		const digits = sol['digits'] as number[][] | undefined;
		if (digits) {
			for (let r = 0; r < rows; r++)
				for (let c = 0; c < cols; c++)
					clauses.push(`digits[${r+1},${c+1}] != ${digits[r][c]}`);
		}
	}
	if (puzzle.solutionSpaces.borders.enabled) {
		const bh = sol['border_h'] as boolean[][] | undefined;
		const bv = sol['border_v'] as boolean[][] | undefined;
		if (bh) {
			for (let r = 0; r <= rows; r++)
				for (let c = 0; c < cols; c++)
					clauses.push(`border_h[${r+1},${c+1}] != ${bh[r][c]}`);
		}
		if (bv) {
			for (let r = 0; r < rows; r++)
				for (let c = 0; c <= cols; c++)
					clauses.push(`border_v[${r+1},${c+1}] != ${bv[r][c]}`);
		}
	}
	if (puzzle.solutionSpaces.lines.enabled) {
		const lh = sol['line_h'] as number[][] | undefined;
		const lv = sol['line_v'] as number[][] | undefined;
		if (lh) {
			for (let r = 0; r < rows; r++)
				for (let c = 0; c < cols - 1; c++)
					clauses.push(`line_h[${r+1},${c+1}] != ${lh[r][c]}`);
		}
		if (lv) {
			for (let r = 0; r < rows - 1; r++)
				for (let c = 0; c < cols; c++)
					clauses.push(`line_v[${r+1},${c+1}] != ${lv[r][c]}`);
		}
	}

	if (clauses.length === 0) return '';
	return `constraint ${clauses.join(' \\/ ')};`;
}

// ── Puzzle loader ─────────────────────────────────────────────────────────────

function asPuzzle(json: unknown): PuzzleState {
	const p = json as PuzzleState;
	if (!p.solutionSpaces.modifiers) {
		return { ...p, solutionSpaces: { ...p.solutionSpaces, modifiers: { enabled: false, min: 1, max: 18 } } };
	}
	return p;
}

async function assertUnique(puzzle: PuzzleState, rules: ReturnType<typeof getAllLoadedRules>) {
	const model = compilePuzzle(puzzle, rules);
	const sol = await firstSolution(model);
	expect(sol, 'puzzle should have at least one solution').not.toBeNull();
	const exclusion = buildExclusionConstraint(sol!, puzzle);
	expect(exclusion, 'exclusion constraint should be non-empty').not.toBe('');
	const model2 = model.replace('solve satisfy;', `${exclusion}\nsolve satisfy;`);
	expect(await satStatus(model2), 'puzzle should have no second solution').toBe('UNSATISFIABLE');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const rules = getAllLoadedRules();

describe('slither_test', () => {
	const puzzle = asPuzzle(slitherJson);

	it('has a unique solution', async () => {
		await assertUnique(puzzle, rules);
	});
});

describe('hashi_doku', () => {
	const puzzle = asPuzzle(hashiJson);

	it('stored solution satisfies all rules', async () => {
		const model = compilePuzzleForCheck(puzzle, rules);
		expect(await satStatus(model)).toBe('SATISFIED');
	});

	it('has a unique solution', async () => {
		await assertUnique(puzzle, rules);
	});
});
