# Architecture

## Layers

```
src/engine/        pure TypeScript: grid, search, maze generation
      │            (no React, no DOM, no timers; randomness injected)
      ▼
src/components/    React UI: snapshots board state into an engine Grid,
                   runs the engine, animates the events it returns
```

The engine never knows it's being animated. It turns a problem into data
(a list of events or wall placements), and the UI decides how and when to
show that data. That split is what makes the algorithms testable in
isolation and will let other views (a canvas renderer, a side-by-side
"race" of several algorithms, a 3D view) reuse the same results.

## Data model

A board is a `Grid` (`src/engine/grid.ts`): `rows`, `columns`, and two
flat `Uint8Array`s indexed by `row * columns + column`:

- `walls[i]`: 1 if cell `i` is a wall.
- `weights[i]`: the cost of _entering_ cell `i` (1 = normal terrain; the
  UI's weighted terrain is 5).

Start and goal are plain cell indices.

## Pathfinding

`search(problem, algorithm)` is a generator. It yields a `SearchEvent`
per step and returns a `SearchResult`:

| Event      | Meaning                                                   |
| ---------- | --------------------------------------------------------- |
| `discover` | a cell reached for the first time (added to the frontier) |
| `expand`   | a cell taken off the frontier and its neighbors examined  |

The result is `{ path, cost, expanded, discovered }`. `path` runs from
start to goal (both included), or is `null` when the goal is unreachable.
`cost` is the path's terrain-weighted cost for every algorithm, so results
can be compared across algorithms. `runSearch()` drains the generator into
an array; stepping the generator directly gives lazy, step-by-step
playback.

All five algorithms are the same loop, parameterized by a spec:

| Algorithm | Frontier | Re-push a neighbor…           | Priority                            | Guarantee    |
| --------- | -------- | ----------------------------- | ----------------------------------- | ------------ |
| BFS       | queue    | never (first discovery only)  | -                                   | fewest steps |
| DFS       | stack    | until it's expanded           | -                                   | none         |
| Greedy    | min-heap | never                         | h (Euclidean)                       | none         |
| Dijkstra  | min-heap | when a cheaper route is found | g                                   | lowest cost  |
| A*        | min-heap | when a cheaper route is found | g + h (Manhattan), ties toward goal | lowest cost  |

### Adding a pathfinding algorithm

1. Add its id to `PathAlgorithmId`, an entry to `PATH_ALGORITHMS` (label,
   `usesWeights`, `optimality`) and a spec to `SPECS` in `pathfinding.ts`.
   If it doesn't fit the spec model, give it its own generator with the
   same signature instead of complicating `search()`.
2. The property tests in `pathfinding.test.ts` pick it up through
   `PATH_ALGORITHMS`. If its `optimality` is `always` or `unweighted`, the
   matching optimality property also covers it.
3. Add a snapshot case (automatic via `PATH_ALGORITHMS`) and review the
   ASCII output.

The config panel's menu is built from `PATH_ALGORITHMS`, so no UI change
is needed.

## Maze generation

`generateMaze(problem, algorithm, random?)` returns `WallPlacement[]`:
`{ index, tick }` sorted by `tick`, one per walled cell. The tick is the
animation step the wall appears on, and several walls can share one:
Recursive Division's sibling regions and the outer border all build in
parallel. The UI multiplies ticks by its per-step delay. Passing
`seededRandom(seed)` makes a maze exactly reproducible.

Adding a maze algorithm follows the same pattern as pathfinding: an entry
in `MAZE_ALGORITHMS`, a branch in `generateMaze`, and it's automatically
covered by the property tests (never walls start/goal, always keeps them
connected, deterministic per seed) and snapshots in `mazes.test.ts`.

## Testing strategy

- **Property tests** (fast-check) run every algorithm on thousands of
  random boards and compare it against deliberately naive reference
  solvers in `src/test-support/grid-problems.ts`. When one fails,
  fast-check shrinks the input to a minimal counterexample.
- **Snapshot tests** pin exact behavior on a fixed board/seed as readable
  ASCII, so a behavior change shows up as a diff in review.
- **Component tests** (Testing Library) cover the UI: painting, dragging,
  resets, and cancellation mid-animation.

History note: the engine replaced `src/algorithms/`. Before that code was
deleted, comparison tests showed BFS/DFS, all maze generators and the
path-segment drawing matched it exactly. The property tests also found
that the old A* wasn't optimal (commit "Add property-based pathfinding
tests; they expose an A* optimality bug").
