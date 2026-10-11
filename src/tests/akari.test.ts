import { describe, it, expect } from 'vitest';
import * as MiniZinc from 'minizinc';
import type { SolutionMessage } from 'minizinc';
import { getAllLoadedRules } from '$lib/rules/registry';
import { compilePuzzle } from '$lib/solver/compiler';
import { createBlankPuzzle, createVariableInstance } from '$lib/model/defaults';
import { createVarGrid } from '$lib/model/variables';
import { syncEffectiveGlobalRules } from '$lib/model/migrate';
import type { PuzzleState } from '$lib/model/types';

let mzReady = false;
async function initMZ() {
	if (mzReady) return;
	await MiniZinc.init({
		workerURL: `${location.origin}/minizinc-worker.js`,
		wasmURL: `${location.origin}/minizinc.wasm`,
		dataURL: `${location.origin}/minizinc.data`,
	});
	mzReady = true;
}

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
 * 3×3 Akari: a single wall in the center carrying a "4" clue.
 * Forced solution — lights at exactly the 4 orthogonal neighbors:
 *   . L .
 *   L W L
 *   . L .
 */
function buildAkari3x3(): PuzzleState {
	const p = createBlankPuzzle(3, 3);
	const walls = createVariableInstance('boolean', 'Walls');
	const lights = createVariableInstance('boolean', 'Lights');
	p.variables = [walls, lights];
	p.varData = {
		[walls.id]: createVarGrid('boolean', 3, 3),
		[lights.id]: createVarGrid('boolean', 3, 3)
	};
	// Walls are fully given: center wall, everything else empty
	for (let r = 0; r < 3; r++) {
		for (let c = 0; c < 3; c++) {
			const s = p.varData[walls.id].cells![r][c];
			s.value = r === 1 && c === 1;
			s.isGiven = true;
		}
	}
	// Activate the akari ruleset with explicit slot bindings (Walls, Lights)
	p.activeRulesets = [{ rulesetId: 'akari', bindings: [walls.id, lights.id] }];
	// One clue on the wall: all 4 neighbors are lights
	p.localRules = [
		{
			ruleId: 'akari-clue',
			id: 'clue1',
			groups: [{ cells: [{ row: 1, col: 1 }], value: 4 }],
			bindings: [lights.id]
		}
	];
	syncEffectiveGlobalRules(p);
	return p;
}

describe('akari ruleset', () => {
	const rules = getAllLoadedRules();
	const puzzle = buildAkari3x3();
	const model = compilePuzzle(puzzle, rules);

	it('compiles slot-bound predicate calls', () => {
		// Walls = first boolean (shaded), Lights = second (shaded_2)
		expect(model).toContain('constraint booleans_disjoint(shaded, shaded_2);');
		expect(model).toContain('constraint lights_dont_see(shaded, shaded_2);');
		expect(model).toContain('constraint unshaded_see_light(shaded, shaded_2);');
		// Local clue: whole lights grid + 1-indexed coordinates + value
		expect(model).toContain('constraint akari_clue(shaded_2, [2], [2], 4);');
	});

	it('solves to the forced light pattern', async () => {
		const sol = await firstSolution(model);
		expect(sol).not.toBeNull();
		const lights = sol!['shaded_2'] as boolean[][];
		expect(lights).toEqual([
			[false, true, false],
			[true, false, true],
			[false, true, false]
		]);
	});
});
