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
changes. Why things are the way they are (Biome vs ESLint, plain three vs
React Three Fiber, the CSP, deferred upgrades):
[docs/decisions.md](docs/decisions.md) - read it before undoing one of
those choices, and add an entry when you make a comparable one.

## Definition of done

A change is done when:

1. `npm run verify:full` passes (see "Verifying a change" below).
2. Its behavior is pinned by a test that fails without it. Check that by
   breaking the change temporarily; tests that can't fail are worse than
   none.
3. The docs still tell the truth: README, this file, and
   `docs/architecture.md` for anything structural. `npm run check:docs`
   catches references to things that no longer exist, not wrong
   explanations, so reread the affected sections.
4. A choice a reviewer might question has an entry in
   `docs/decisions.md`.
5. Visible UI changes: regenerate the README images (`npm run assets`)
   and look at them before committing.

## Where things live

- `src/engine/` - pure TypeScript, no React/DOM. The UI imports only from
  `src/engine/index.ts`; never import React or touch the DOM from here.
  - `grid.ts` - the board as flat typed arrays (`walls`, `weights` = cost
    of entering a cell), `index = row * columns + column`. Also the one
    definition of `WEIGHTED_TERRAIN_COST`; import it rather than writing
    5 anywhere.
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
    straight through - keep it (see its comment). Start/goal on the outer
    border is routed into the interior by `anchorRoute`; the
    connectivity property tests draw start/goal from anywhere, border
    included - keep them that way.
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
    up front; playback only decides how much is shown. A dragged marker
    only _covers_ the cells it passes over and restores them; only the
    drop cell is cleared. `boardRevision` changes for board edits only
    (not runs); the UI uses it to drop a stale share link from the URL.
  - `runs.ts` - a run as per-cell reveal ticks (`discoverTick`,
    `pathTick`, `wallTick`): cell `i` is visible once the playhead passes
    its tick. That's what makes scrubbing/stepping trivial.
  - `share.ts` - share links (`#v=1&b=…&m=…&a=…`). Links are **untrusted
    input**: `decodeShare` must never throw and must reject anything
    outside its limits (see the fuzz tests in `share.test.ts`). If you
    change the binary layout, bump `SHARE_VERSION` - old links must fail
    cleanly, not decode into a different board. Boards are 5..200 cells
    per side.
- `src/components/` - React UI, kept thin.
  - `workspace.tsx` is the page (mode, sidebar, share/load);
    `board-area.tsx` lays out one board or a race grid, plus playback and
    the legend; `run-results.tsx` has the explore stats, the pseudocode
    panel and the race standings.
  - `board-renderer.ts` draws a frame as a pure function of
    (snapshot, run, tick) - `cellLayer()` holds the "what does this cell
    look like now" logic and is unit-tested; `board-canvas.tsx` does
    sizing, redraw scheduling, pointer and keyboard input (fast drags are
    filled in by `cellsBetween()` in `board-geometry.ts`).
  - `algorithm-guides.ts` - per-algorithm pseudocode and explanations.
    Keep the pseudocode in step with `SPECS` in `engine/pathfinding.ts`.
  - `board-3d/` - the lazily loaded 3D view (plain `three`, no React
    Three Fiber). `cell-pose.ts` maps `cellLayer()` to a box height and
    color (pure, unit-tested); `board-scene.ts` is the imperative
    three.js scene (one `InstancedMesh` for all cells, path tube);
    `board-3d.tsx` mounts it. Two rules learned the hard way:
    - Reach the 3D view only through `board-3d/load` (a dynamic
      `import()`), as `board-area.tsx` does with a fresh `React.lazy`
      per retry. Importing `board-3d` or three anywhere else pulls
      three.js into the main bundle - `npm run check:bundle` fails if it
      does.
    - Create a fresh `<canvas>` per scene. `dispose()` deliberately loses
      the WebGL context, and a canvas that lost its context can never
      make a working one again.
  - `error-boundary.tsx` - contains a failing subtree so it can't unmount
    the whole app. Used twice: around the 3D view (`board-area.tsx`) and
    around the whole app (`App.tsx`).
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
    never fixed waits: runs may finish before a click lands. Waiting for
    the 3D view uses `THREE_D_TIMEOUT` (software WebGL is slow on CI).
  - `e2e/a11y.spec.ts` runs axe (WCAG 2.1 A/AA) on each major UI state;
    new UI states get a case there.
  - `e2e/assets.spec.ts` is not a test: `npm run assets` uses it to
    regenerate `docs/images/*`, `public/og-image.jpg` and the icons.
- Unit tests can't exercise WebGL (jsdom has none): the 3D view is
  covered by the e2e suite. Component tests that switch to 3D only see its
  "needs WebGL" fallback, and `board-area.test.tsx` mocks
  `board-3d/load` to test load failures and retry.

## Verifying a change

```bash
npm run verify          # all of the below except e2e, in one go
npm run verify:full     # verify + e2e: run this before calling a change done
```

which is:

```bash
npm run format:check
npm run lint            # --max-warnings 0: warnings fail too
npm run typecheck
npm run check:docs      # docs reference only paths/scripts/identifiers that exist
npm run test:run
npm run build
npm run check:bundle    # gzipped size budgets; three.js stays out of the main bundle
npm run test:e2e        # Playwright; first time: npx playwright install chromium
```

`npm run bench` prints engine benchmarks (report-only; see the note in
`src/engine/engine.bench.ts` about absolute numbers).

CI (`.github/workflows/ci.yml`) runs all of the above plus `npm audit`.
Actions are pinned to commit SHAs; Dependabot bumps them.
`.github/pull_request_template.md` repeats the definition of done for
human reviewers; `SECURITY.md` covers reporting and the security-relevant
parts of the code.

## Deployment

See the README's Deployment section. `.github/workflows/deploy.yml`
deploys to GitHub Pages only after CI succeeds for a push to `main`
(`workflow_run`), and deploys exactly the commit CI tested. That's the
only deploy path; there is no local deploy script.
