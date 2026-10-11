import { describe, it, expect, beforeAll } from 'vitest';
import * as MiniZinc from 'minizinc';
import neighborsMzn from '../../imports/neighbors.mzn?raw';
import kingSumConstraint from './rule.mzn?raw';

let mzInitialized = false;

async function initMZ() {
	if (mzInitialized) return;
	await MiniZinc.init({
		workerURL: `${location.origin}/minizinc-worker.js`,
		wasmURL: `${location.origin}/minizinc.wasm`,
		dataURL: `${location.origin}/minizinc.data`,
	});
	mzInitialized = true;
}

type Given = [row: number, col: number, value: number];

function buildModel(opts: {
	rows: number;
	cols: number;
	minDigit: number;
	maxDigit: number;
	latinRows?: boolean;
	latinCols?: boolean;
	givens?: Given[];
}) {
	const { rows, cols, minDigit, maxDigit } = opts;
	const lines: string[] = [
		`int: rows = ${rows};`,
		`int: cols = ${cols};`,
		`array[1..rows, 1..cols] of var ${minDigit}..${maxDigit}: digits;`,
		'',
		neighborsMzn,
		'',
	];

	if (opts.latinRows) {
		lines.push(
			'constraint forall(r in 1..rows, c1 in 1..cols, c2 in c1+1..cols)(digits[r,c1] != digits[r,c2]);'
		);
	}
	if (opts.latinCols) {
		lines.push(
			'constraint forall(c in 1..cols, r1 in 1..rows, r2 in r1+1..rows)(digits[r1,c] != digits[r2,c]);'
		);
	}

	for (const [r, c, v] of opts.givens ?? []) {
		lines.push(`constraint digits[${r},${c}] = ${v};`);
	}

	lines.push('', kingSumConstraint, 'constraint king_sum_multiple(digits);', 'solve satisfy;');
	return lines.join('\n');
}

async function satStatus(model: string): Promise<string> {
	await initMZ();
	const m = new MiniZinc.Model();
	m.addFile('test.mzn', model);
	const result = await m.solve({ options: { solver: 'chuffed' } });
	return result.status;
}

function isSat(status: string) {
	return status === 'SATISFIED' || status === 'ALL_SOLUTIONS' || status === 'OPTIMAL_SOLUTION';
}

// ── Latin square tests ────────────────────────────────────────────────────────

describe('king-sum-multiple + latin square', () => {
	it('2×2 latin square has solutions', async () => {
		const model = buildModel({ rows: 2, cols: 2, minDigit: 1, maxDigit: 2, latinRows: true, latinCols: true });
		expect(isSat(await satStatus(model))).toBe(true);
	});

	it('3×3 latin square has no solutions', async () => {
		const model = buildModel({ rows: 3, cols: 3, minDigit: 1, maxDigit: 3, latinRows: true, latinCols: true });
		expect(await satStatus(model)).toBe('UNSATISFIABLE');
	});

	it('4×4 latin square has no solutions', async () => {
		const model = buildModel({ rows: 4, cols: 4, minDigit: 1, maxDigit: 4, latinRows: true, latinCols: true });
		expect(await satStatus(model)).toBe('UNSATISFIABLE');
	});
});

// ── Non-latin SAT tests ───────────────────────────────────────────────────────

describe('king-sum-multiple (no latin constraint, SAT)', () => {
	it('3×3 grid of all-2s satisfies constraint', async () => {
		// All neighbors sum = k*2, and k*2 mod 2 = 0 always
		const givens: Given[] = [];
		for (let r = 1; r <= 3; r++)
			for (let c = 1; c <= 3; c++)
				givens.push([r, c, 2]);
		const model = buildModel({ rows: 3, cols: 3, minDigit: 1, maxDigit: 9, givens });
		expect(isSat(await satStatus(model))).toBe(true);
	});

	it('3×3 checkerboard pattern [1 2 1 / 2 4 2 / 1 2 1] satisfies constraint', async () => {
		// Corner cells = 1: any sum mod 1 = 0
		// Edge cells = 2: sum of 5 neighbors = 1+1+2+4+2 = 10, 10 mod 2 = 0
		// Center cell = 4: sum of 8 neighbors = 4*2 + 4*1 = 12, 12 mod 4 = 0
		const givens: Given[] = [
			[1,1,1], [1,2,2], [1,3,1],
			[2,1,2], [2,2,4], [2,3,2],
			[3,1,1], [3,2,2], [3,3,1],
		];
		const model = buildModel({ rows: 3, cols: 3, minDigit: 1, maxDigit: 9, givens });
		expect(isSat(await satStatus(model))).toBe(true);
	});

	it('1×1 grid trivially satisfies constraint (no neighbors, sum = 0)', async () => {
		// A 1×1 grid has no king neighbors; sum([]) = 0; 0 mod anything = 0
		const model = buildModel({ rows: 1, cols: 1, minDigit: 1, maxDigit: 9 });
		expect(isSat(await satStatus(model))).toBe(true);
	});
});

// ── Non-latin UNSAT tests ─────────────────────────────────────────────────────

describe('king-sum-multiple (no latin constraint, UNSAT)', () => {
	it('2×2 grid [2 3 / 3 2] violates constraint', async () => {
		// Cell (1,2) = 3: king neighbors = {2, 3, 2}, sum = 7; 7 mod 3 = 1 ≠ 0
		const givens: Given[] = [
			[1,1,2], [1,2,3],
			[2,1,3], [2,2,2],
		];
		const model = buildModel({ rows: 2, cols: 2, minDigit: 1, maxDigit: 9, givens });
		expect(await satStatus(model)).toBe('UNSATISFIABLE');
	});

	it('2×2 grid [3 2 / 2 3] also violates constraint', async () => {
		// Cell (1,1) = 3: king neighbors = {2, 2, 3}, sum = 7; 7 mod 3 ≠ 0
		const givens: Given[] = [
			[1,1,3], [1,2,2],
			[2,1,2], [2,2,3],
		];
		const model = buildModel({ rows: 2, cols: 2, minDigit: 1, maxDigit: 9, givens });
		expect(await satStatus(model)).toBe('UNSATISFIABLE');
	});

	it('2×2 grid [7 5 / 5 7] violates constraint', async () => {
		// Cell (1,1) = 7: king neighbors = {5, 5, 7}, sum = 17; 17 mod 7 = 3 ≠ 0
		const givens: Given[] = [
			[1,1,7], [1,2,5],
			[2,1,5], [2,2,7],
		];
		const model = buildModel({ rows: 2, cols: 2, minDigit: 1, maxDigit: 9, givens });
		expect(await satStatus(model)).toBe('UNSATISFIABLE');
	});
});
