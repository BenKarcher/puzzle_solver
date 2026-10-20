// Regression tests for the WASM minizinc build (custom Chuffed).
// Run: node solver-build/test-candidates.mjs [dir with minizinc.js/.wasm/.data]
// (default: solver-build/mzn-install/bin). build.sh runs this as its `test` step.
//
// minizinc-js's Node build spawns the native `minizinc`, so this loads the
// Emscripten module directly instead. Each run gets a fresh instance: a second
// callMain in the same instance can crash.

import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(process.argv[2] ?? path.join(here, 'mzn-install/bin'));
const require = createRequire(import.meta.url);

// minizinc.js is a CommonJS script, but this package is "type": "module".
const src = readFileSync(path.join(dir, 'minizinc.js'), 'utf8');
const MINIZINC = new Function('require', '__dirname', '__filename', `${src}\nreturn MINIZINC;`)(
	require,
	dir,
	path.join(dir, 'minizinc.js')
);

async function run(model, args) {
	const out = [];
	const M = await MINIZINC({
		locateFile: (f) => path.join(dir, f),
		print: (s) => out.push(s),
		printErr: (s) => out.push(s),
		noInitialRun: true
	});
	M.FS.mkdir('/work');
	M.FS.writeFile('/work/model.mzn', model);
	M.FS.chdir('/work');
	const code = M.callMain(['--solver', 'chuffed', ...args, 'model.mzn']);
	const text = out.join('\n');
	return {
		code,
		text,
		solutions: (text.match(/^----------$/gm) ?? []).length,
		complete: /^==========$/m.test(text)
	};
}

let failed = 0;
function check(name, ok, detail) {
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
	if (!ok) failed++;
}

// 1. --true-candidates: every value in each true candidate set must show up.
{
	const r = await run(
		'var 1..3: x;\nvar 1..3: y;\nconstraint x != y;\nconstraint x < 3;\nsolve satisfy;\n',
		['--true-candidates']
	);
	const seen = { x: new Set(), y: new Set() };
	for (const m of r.text.matchAll(/^(x|y) = (\d+);$/gm)) seen[m[1]].add(+m[2]);
	const got = `x={${[...seen.x].sort()}} y={${[...seen.y].sort()}}`;
	check('true-candidates', r.code === 0 && got === 'x={1,2} y={1,2,3}', got);
}

// 2. Native connected: two constraints sharing literals. Stock Chuffed 0.14.0
//    accepts 2 invalid solutions here (18 instead of 16).
{
	const r = await run(
		`include "connected.mzn";
array[1..6] of var bool: nv;
array[1..7] of var bool: ev;
constraint connected([1,1,2,3], [2,4,3,5], [nv[1],nv[2],nv[3],nv[4],nv[4]], [ev[1],ev[2],ev[3],ev[5]]);
constraint connected([1,2,2,3,4], [2,3,4,5,5], [nv[1],nv[2],nv[3],nv[5],nv[6]], [ev[1],ev[3],ev[4],(not ev[5]),ev[7]]);
constraint not ev[6] \\/ not nv[4];
constraint ev[6] \\/ ev[4];
solve satisfy;
`,
		['-a']
	);
	check('connected: no invalid solutions', r.complete && r.solutions === 16, `${r.solutions} solutions`);
}

// 3. Native connected: network-fillomino's reproducer, if that checkout is
//    next to this one. Stock Chuffed 0.14.0 finds 616 of its 700 solutions.
{
	const f = path.resolve(here, '../../network-fillomino/bench/chuffed-connected-bug/connected.mzn');
	if (existsSync(f)) {
		const r = await run(readFileSync(f, 'utf8'), ['-a']);
		check('connected: no missing solutions', r.complete && r.solutions === 700, `${r.solutions} solutions`);
	} else {
		console.log(`skip connected: no missing solutions (${f} not found)`);
	}
}

if (failed) {
	console.log(`${failed} test(s) failed`);
	process.exit(1);
}
