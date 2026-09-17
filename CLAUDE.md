# CLAUDE.md

Guidance for working in this repository.

## What this is

`pathfinding-visualizer` is a Vite + React + TypeScript app that animates
pathfinding algorithms (BFS, DFS, Dijkstra's, A*, Greedy Best-first) and
maze/wall-generation algorithms (Recursive Division, single- and
double-thickness) on a grid. No backend; deployed as a static site to
GitHub Pages via `.github/workflows/deploy.yml`.

## Where things live

- `src/algorithms/paths.tsx` - all 5 pathfinding algorithms. BFS/DFS and
  Dijkstra/A*/Greedy each reduce to one shared `search()` core
  (frontier-exploration loop), parameterized by which frontier data
  structure (`Queue`/`Stack`/`PriorityQueueAscend`) and priority function
  each algorithm uses - see the comment above `search()` before adding a
  6th algorithm or changing how any existing one explores.
- `src/algorithms/walls.tsx` - both Recursive Division variants reduce to
  one shared `buildDividingWalls()`, parameterized by wall thickness (1 or
  2 cells). It always leaves exactly one opening per wall, which is what
  guarantees every generated maze stays fully connected - keep that
  invariant if you touch the exclusion-zone logic.
- `src/models/models.ts` - the typed data structures the algorithms run
  on: `Stack`/`Queue`/`PriorityQueueAscend`/`PriorityQueueDescend` (the
  two priority queues are a real binary heap, not a sort-per-push array -
  keep it that way, it's the difference between O(n log n) and O(n² log n)
  per search) and the `CoordinateAndDirection`/`SearchNode` types. New
  generic data structures belong here, not back in a `util/` file.
- `src/util/function-util.tsx` - small math/random helpers used by the
  algorithms above. `getEuclideanDistance` must return true (not squared)
  distance - A*'s shortest-path guarantee depends on it never
  overestimating the real grid distance.

## Verifying a change

```bash
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
`.github/workflows/deploy.yml` (Actions-based, primary); `npm run deploy`
(the `gh-pages` package) is a manual local fallback.
