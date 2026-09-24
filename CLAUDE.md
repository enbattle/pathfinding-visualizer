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
- `src/components/` - React UI. `board.tsx` snapshots its state into an
  engine `Grid`, runs the engine, and animates the result;
  `path-segments.ts` picks the CSS class for each cell of the final path.
- Animation timing: every animated step goes through `board.tsx`'s
  `scheduleTimeout`, never a bare `setTimeout`. The board tracks every
  pending step so Reset can cancel it and so Build Walls/Visualize are
  ignored while anything is still animating (regression tests in
  `configurations.test.tsx`: "resetting mid-wall-build..." and "ignores
  Visualize while walls are still being built").

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

## Verifying a change

```bash
npm run format:check
npm run typecheck
npm run lint
npm run test:run
npm run build
```

`npm run dev` for manual checks: build walls with each algorithm, run each
of the 5 path algorithms against them, and confirm start/goal stay
reachable and the animation renders correctly.

## Deployment

See the README's Deployment section - pushing to `main` runs
`.github/workflows/deploy.yml` (GitHub Actions -> Pages). That's the only
deploy path; there is no local `npm run deploy`.
