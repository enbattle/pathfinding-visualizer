// Fails if the Markdown docs refer to things that don't exist: file paths,
// `npm run` scripts, or code identifiers. Docs drift silently as code moves
// (an independent audit found several stale references by hand); this makes
// that a CI failure instead. Run with `npm run check:docs`.
//
// What it checks, inside `backticks` in every tracked *.md file:
//   - paths (containing "/" or ending in a known extension) must exist,
//     either from the repo root or, for a bare file name, somewhere in the
//     repo;
//   - `npm run <script>` must name a script in package.json;
//   - identifiers that look like code (camelCase with a capital, PascalCase,
//     UPPER_SNAKE, or name()) must appear in some tracked source file.
// Anything that's legitimately external goes in EXTERNAL below.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

// Names the docs mention that live outside this repo (browser, React,
// libraries, GitHub) - so they can't be found in its sources.
const EXTERNAL = new Set([
  'InstancedMesh',
  'OrbitControls',
  'React.lazy',
  'SwiftShader',
  'TubeGeometry',
  'WebGL',
  'WebGLRenderer',
  'forceContextLoss',
  'getContext',
  'requestAnimationFrame',
  'setTimeout',
  'setInterval',
  'useSyncExternalStore',
  'workflow_run',
  'workflow_dispatch',
  'webglcontextlost',
  'toDataURL',
  'readPixels',
  'testInfo.attach',
  'npm audit',
  'npm ci',
  'npx playwright install chromium',
  'npx vitest run -u',
  'vite preview',
  'vitest bench',
  'actions/deploy-pages',
  'actions/checkout',
  'actions/setup-node',
]);

// Paths deleted on purpose that docs still name in history notes.
const HISTORICAL = new Set(['src/algorithms/', 'src/algorithms']);

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter(file => existsSync(file));
const trackedNames = new Set(tracked.map(file => basename(file)));
const sourceText = tracked
  .filter(file => /\.(ts|tsx|mjs|js|css|json|yml|html)$/.test(file))
  .filter(file => file !== 'package-lock.json')
  .map(file => readFileSync(file, 'utf8'))
  .join('\n');
const scripts = new Set(
  Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).scripts)
);

const PATH_LIKE = /\.(ts|tsx|mjs|js|json|yml|yaml|md|css|html|png|txt)$/;
const IDENTIFIER =
  /^(?:[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*|[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*|[A-Z][A-Z0-9]*_[A-Z0-9_]+|[A-Za-z_][A-Za-z0-9_]*\(\))$/;

const problems = [];
for (const doc of tracked.filter(file => file.endsWith('.md'))) {
  const lines = readFileSync(doc, 'utf8').split('\n');
  let inFence = false;
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      return;
    }
    const where = `${doc}:${i + 1}`;
    // Commands inside fenced blocks: npm run <script>.
    for (const [, script] of line.matchAll(/npm run ([\w:-]+)/g)) {
      if (!scripts.has(script))
        problems.push(`${where}: npm script "${script}" doesn't exist`);
    }
    if (inFence) return;
    for (const [, raw] of line.matchAll(/`([^`]+)`/g)) {
      const token = raw.trim();
      if (EXTERNAL.has(token) || HISTORICAL.has(token) || token.includes(' '))
        continue;
      // Paths, with an optional :line suffix.
      const path = token.replace(/:\d+(-\d+)?$/, '').replace(/\/$/, '');
      if (path.includes('/') || PATH_LIKE.test(path)) {
        if (/^https?:|^\.|\*|\$\{|<|>|^[a-z]+:$/.test(path)) continue;
        // Import specifiers omit the extension (e.g. board-3d/load).
        const candidates = [
          path,
          ...['.ts', '.tsx', '.mjs'].map(ext => path + ext),
        ];
        const exists =
          candidates.some(
            candidate =>
              existsSync(candidate) ||
              tracked.some(file => file.endsWith('/' + candidate))
          ) ||
          (!path.includes('/') && trackedNames.has(path)) ||
          tracked.some(
            file => file.endsWith(`/${path}`) || file.startsWith(`${path}/`)
          );
        if (!exists) problems.push(`${where}: path \`${token}\` doesn't exist`);
        continue;
      }
      if (IDENTIFIER.test(token)) {
        const name = token.replace(/\(\)$/, '');
        if (!new RegExp(`\\b${name}\\b`).test(sourceText)) {
          problems.push(
            `${where}: \`${token}\` isn't defined or used in any source file`
          );
        }
      }
    }
  });
}

if (problems.length > 0) {
  console.error(
    `Docs refer to things that don't exist:\n- ${problems.join('\n- ')}`
  );
  console.error(
    '\nFix the doc, or add genuinely external names to EXTERNAL in scripts/check-docs.mjs.'
  );
  process.exit(1);
}
console.log(
  'Docs check passed: every referenced path, script and identifier exists.'
);
