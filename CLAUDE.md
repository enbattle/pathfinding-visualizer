# CLAUDE.md

Guidance for working in this repository.

## What this is

`pathfinding-visualizer` is a Vite + React + TypeScript app that animates
pathfinding algorithms (BFS, DFS, Dijkstra's, A*, Greedy Best-first) and
maze/wall-generation algorithms (Recursive Division, single- and
double-thickness, and randomized Prim's) on a grid. No backend; deployed
as a static site to GitHub Pages via `.github/workflows/deploy.yml`.

Architecture overview (layers, data flow, how to add an algorithm):
[docs/architecture.md](docs/architecture.md). Read it before structural
changes.

## Where things live

- `src/engine/` - pure TypeScript, no React/DOM. The UI imports only from
  `src/engine/index.ts`; never import React or touch the DOM from here.
  - `grid.ts` - the board as flat typed arrays (`walls`, `weights` = cost
    of entering a cell), `index = row * columns + column`.
  - `pathfinding.ts` - all 5 algorithms are one generator, `search()`,
    differing only in their `SPECS` entry (frontier type, admission rule,
    priority, heuristic). Read the comments on `AdmissionRule` and `SPECS`
    before adding a 6th algorithm or changing how one explores.
    `PATH_ALGORITHMS` holds UI labels and each algorithm's optimality
    guarantee.
  - `heuristics.ts` - A* must use an admissible, consistent heuristic
    (Manhattan) or it stops returning lowest-cost paths. Never scale or
    square it.
  - `mazes.ts` - `generateMaze()` returns timed `{ index, tick }` wall
    placements. Recursive Division's walls each leave one opening, which
    keeps mazes connected; `isEmbeddedInWall` deliberately widens the
    start/goal exclusion when start/goal sits on a row/column a wall runs
    straight through - keep it (see its comment).
  - `random.ts` - randomness is always injected (`Random`); use
    `seededRandom(seed)` in tests. No bare `Math.random()` in algorithms.
  - `collections.ts` - `Stack`/`Queue` (O(1)) and `MinHeap` (binary heap
    with a tiebreak key). Keep them O(1)/O(log n).
- `src/player/player.ts` - the playhead: moves a tick position over time
  via an injected `FrameClock` (requestAnimationFrame in the app,
  `test-support/fake-clock.ts` in tests). Play/pause/step/seek/rate.
- `src/visualizer/` - pure TS app state, no React/DOM.
  - `visualizer.ts` - `Visualizer`: the board (grid, start/goal), the run
    on screen, the `player`, every user command (visualize, buildMaze,
    resets) and the paint/drag gesture rules. Runs are computed in full
    up front; playback only decides how much is shown.
  - `runs.ts` - a run as per-cell reveal ticks (`discoverTick`,
    `pathTick`, `wallTick`): cell `i` is visible once the playhead passes
    its tick. That's what makes scrubbing/stepping trivial.
  - `share.ts` - share links (`#v=1&b=…&m=…&a=…`). Links are **untrusted
    input**: `decodeShare` must never throw and must reject anything
    outside its limits (see the fuzz tests in `share.test.ts`). If you
    change the binary layout, bump `SHARE_VERSION` - old links must fail
    cleanly, not decode into a different board.
- `src/components/` - React UI, kept thin.
  - `workspace.tsx` is the page (mode, sidebar, share/load);
    `board-area.tsx` lays out one board or a race grid, plus playback and
    the legend; `run-results.tsx` has the explore stats, the pseudocode
    panel and the race standings.
  - `board-renderer.ts` draws a frame as a pure function of
    (snapshot, run, tick) - `cellLayer()` holds the "what does this cell
    look like now" logic and is unit-tested; `board-canvas.tsx` does
    sizing, redraw scheduling, pointer and keyboard input.
  - `algorithm-guides.ts` - per-algorithm pseudocode and explanations.
    Keep the pseudocode in step with `SPECS` in `engine/pathfinding.ts`.
  - `board-3d/` - the lazily loaded 3D view (plain `three`, no React
    Three Fiber). `cell-pose.ts` maps `cellLayer()` to a box height and
    color (pure, unit-tested); `board-scene.ts` is the imperative
    three.js scene (one `InstancedMesh` for all cells, path tube);
    `board-3d.tsx` mounts it. Two rules learned the hard way:
    - Only `board-area.tsx` may import `board-3d/board-3d` (and only
      via `React.lazy`). Importing three anywhere else pulls it into the
      main bundle; check `npm run build` output (the `board-3d-*.js`
      chunk).
    - Create a fresh `<canvas>` per scene. `dispose()` deliberately loses
      the WebGL context, and a canvas that lost its context can never
      make a working one again.
  - `error-boundary.tsx` - contains a failing subtree (the 3D view is
    wrapped in one) so it can't unmount the whole app.
- Animation: never use `setTimeout`/`setInterval` to animate. Anything
  that changes over time goes through the `Player`, and everything drawn
  must be derivable from (snapshot, tick) - otherwise scrubbing breaks.
- Board colors are CSS custom properties (`--board-*` in `index.css`),
  read by `readPalette()`. Keep them hex: the renderer blends them.

## Testing conventions

- Algorithm correctness is tested with **fast-check property tests**
  against deliberately naive reference solvers in
  `src/test-support/grid-problems.ts` (they share no code with the
  engine). When you change an algorithm, the properties must still hold;
  when you add one, add it to the relevant properties.
- **Snapshot tests** (`src/engine/__snapshots__/`) pin each algorithm's
  exact output on a fixed board/seed as readable ASCII. A snapshot diff
  means behavior changed - only regenerate (`npx vitest run -u`) when the
  change is intentional, and say so in the commit message.
- Before trusting a new property, check it can fail: temporarily break the
  code it guards and confirm the test goes red.
- **End-to-end tests** (`e2e/`, Playwright, Chromium) run against the
  production build via `vite preview`. They cover what jsdom can't: real
  layout, canvas pixels, WebGL, the lazy 3D chunk and the CSP. Rules:
  - Assert on canvas colors with `expectCellColor()` (exact fills,
    identical on every OS), not pixel-diffed screenshots. Attach
    screenshots with `testInfo.attach` for humans to look at.
  - Use the `test`/`expect` exported by `e2e/fixtures.ts`: its automatic
    `problems` fixture fails any test on a console error, uncaught
    exception or CSP violation.
  - Use deterministic boards (`fixtureLink()`) and `finishPlayback()`,
    never fixed waits: runs may finish before a click lands.
- Unit tests must not import three.js; code that needs WebGL is covered
  by the e2e suite (jsdom has no WebGL).

## Verifying a change

```bash
npm run format:check
npm run lint            # --max-warnings 0: warnings fail too
npm run typecheck
npm run test:run
npm run build
npm run check:bundle    # gzipped size budgets; three.js stays out of the main bundle
npm run test:e2e        # Playwright; first time: npx playwright install chromium
```

`npm run bench` prints engine benchmarks (report-only; see the note in
`src/engine/engine.bench.ts` about absolute numbers).

CI (`.github/workflows/ci.yml`) runs all of the above plus `npm audit`.
Actions are pinned to commit SHAs; Dependabot bumps them.

## Deployment

See the README's Deployment section - pushing to `main` runs
`.github/workflows/deploy.yml` (GitHub Actions -> Pages). That's the only
deploy path; there is no local `npm run deploy`.
