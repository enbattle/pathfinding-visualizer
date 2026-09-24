// Fails the build if the production bundle breaks its budget. Run after
// `npm run build` (CI does). Checks:
//   - gzipped size of the main JS, the lazy 3D chunk, and the CSS;
//   - three.js stays out of the main bundle (it must only arrive with the
//     lazily loaded 3D view - see src/components/board-area.tsx);
//   - index.html doesn't preload the 3D chunk.
// Sizes are gzipped KiB (1024 bytes), so slightly smaller numbers than
// Vite's build output (which uses kB = 1000). Budgets sit ~10-15% above
// today's sizes: raise them deliberately, in a
// commit that says why, not to make a failure go away.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGETS = {
  main: 146 * KB, // today: ~129 KiB
  threeD: 158 * KB, // today: ~139 KiB
  css: 9 * KB, // today: ~8 KiB
};
// Present in any build that includes three.js's renderer (minification
// keeps property names).
const THREE_SIGNATURE = 'isWebGLRenderer';

const dist = 'dist';
const assets = join(dist, 'assets');
const files = readdirSync(assets);
const gzipped = file => gzipSync(readFileSync(join(assets, file))).length;
const kb = bytes => `${(bytes / KB).toFixed(1)} KiB`;

const failures = [];
const report = [];
const check = (label, file, budget) => {
  if (!file) {
    failures.push(`${label}: no matching file in ${assets}`);
    return;
  }
  const size = gzipped(file);
  report.push(
    `${label.padEnd(14)} ${kb(size).padStart(9)} / ${kb(budget)}  ${file}`
  );
  if (size > budget)
    failures.push(
      `${label} is ${kb(size)} gzipped, over its ${kb(budget)} budget`
    );
};

const js = files.filter(file => file.endsWith('.js'));
const main = js.find(file => file.startsWith('index-'));
const threeD = js.find(file => file.startsWith('board-3d-'));
const css = files.find(file => file.endsWith('.css'));

check('main JS', main, BUDGETS.main);
check('3D chunk (lazy)', threeD, BUDGETS.threeD);
check('CSS', css, BUDGETS.css);

if (
  main &&
  readFileSync(join(assets, main), 'utf8').includes(THREE_SIGNATURE)
) {
  failures.push(
    `three.js is in the main bundle (${main}); it must only be imported lazily`
  );
}
const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (threeD && html.includes(threeD)) {
  failures.push(
    'index.html references the 3D chunk, so every visitor would download it'
  );
}

console.log(report.join('\n'));
if (failures.length > 0) {
  console.error(`\nBundle budget check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nBundle budget check passed.');
