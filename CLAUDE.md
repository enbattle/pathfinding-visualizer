# CLAUDE.md

Guidance for working in this repository.

## What this is

`pathfinding-visualizer` is a Vite + React + TypeScript app that animates
pathfinding algorithms (BFS, DFS, Dijkstra's, A*, Greedy Best-first) and
maze/wall-generation algorithms (Recursive Division, single- and
double-thickness, and randomized Prim's) on a grid. No backend; deployed
as a static site to GitHub Pages via `.github/workflows/deploy.yml`.

## Where things live

- `src/algorithms/paths.tsx` - all 5 pathfinding algorithms. BFS/DFS and
  Dijkstra/A*/Greedy each reduce to one shared `search()` core
  (frontier-exploration loop), parameterized by which frontier data
  structure (`Queue`/`Stack`/`PriorityQueueAscend`) and priority function
  each algorithm uses - see the comment above `search()` before adding a
  6th algorithm or changing how any existing one explores.
- `src/algorithms/walls.tsx` - Prim's, plus both Recursive Division
  variants, which reduce to one shared `buildDividingWalls()`,
  parameterized by wall thickness (1 or 2 cells). Each wall normally
  leaves exactly one opening, which is what keeps every generated maze
  fully connected. The one exception is
  deliberate: if start/goal's own row (or column, for vertical walls)
  falls inside the wall's own thickness-span rather than merely being
  adjacent to it, a single-cell exclusion at its own column isn't enough -
  the cells beside it _in that same wall line_ would still be walled,
  sealing off its only remaining access. `isEmbeddedInWall` detects this
  and widens the exclusion to its immediate neighbors too, so start/goal
  is never fully boxed in even when dragged onto a coordinate a wall would
  otherwise run straight through. Regression coverage for this lives in
  `walls.test.ts`'s "placed anywhere (e.g. after dragging)" suite - keep
  both that test and the widened-exclusion behavior if you touch the
  exclusion-zone logic.
- Animation timing: every algorithm in `paths.tsx`/`walls.tsx` schedules
  its animated steps through the injected `ScheduleTimeout` (defined in
  `models.ts`, implemented by `board.tsx`), never `setTimeout` directly.
  The board tracks every pending step so Reset can cancel it and so
  Build Walls/Visualize are ignored while anything is still animating -
  an untracked timer breaks both (regression tests in
  `configurations.test.tsx`: "resetting mid-wall-build..." and "ignores
  Visualize while walls are still being built").
- `src/models/models.ts` - the typed data structures the algorithms run
  on: `Stack`/`Queue`/`PriorityQueueAscend` (a real binary heap, not a
  sort-per-push array - keep it that way, it's the difference between
  O(n log n) and O(n² log n) per search) and the
  `CoordinateAndDirection`/`SearchNode` types. New generic data structures
  belong here, not back in a `util/` file.
- `src/util/function-util.tsx` - small math/random helpers used by the
  algorithms above. `getEuclideanDistance` must return true (not squared)
  distance - A*'s shortest-path guarantee depends on it never
  overestimating the real grid distance.

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
