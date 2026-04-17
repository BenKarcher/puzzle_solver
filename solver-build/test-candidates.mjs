// Test true-candidates mode using the WASM minizinc build
// Run: node solver-build/test-candidates.mjs

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// Use web-worker polyfill for Node
const require = createRequire(import.meta.url);

// Try importing the built minizinc-js for Node
const MiniZinc = await import('./minizinc-js/dist/minizinc-node.mjs');

await MiniZinc.init();

console.log('MiniZinc version:', await MiniZinc.version());
console.log('Available solvers:');
const solvers = await MiniZinc.solvers();
for (const s of solvers) {
  console.log(`  ${s.name} (${s.id})`);
}

const model = new MiniZinc.Model();
model.addString(`
  var 1..3: x;
  var 1..3: y;
  constraint x != y;
  solve satisfy;
`);

console.log('\n--- Test 1: normal solve with chuffed ---');
const solve1 = model.solve({ options: { solver: 'chuffed' } });
solve1.on('solution', (e) => console.log('  solution:', e.output?.json));
solve1.on('error', (e) => console.log('  error:', e.message));
const result1 = await solve1;
console.log('  status:', result1.status);

console.log('\n--- Test 2: true-candidates with chuffed ---');
const model2 = new MiniZinc.Model();
model2.addString(`
  var 1..3: x;
  var 1..3: y;
  constraint x != y;
  solve satisfy;
`);
const solve2 = model2.solve({
  options: {
    solver: 'chuffed',
    'true-candidates': true,
  }
});
let solCount = 0;
solve2.on('solution', (e) => {
  solCount++;
  console.log(`  solution ${solCount}:`, e.output?.json);
});
solve2.on('error', (e) => console.log('  error:', e.message));
const result2 = await solve2;
console.log('  status:', result2.status, 'solutions:', solCount);

MiniZinc.shutdown();
