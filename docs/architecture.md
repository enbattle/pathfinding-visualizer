# Architecture

## Layers

```
src/engine/        pure TS: grid, search, maze generation
      │            (no React, no DOM, no timers; randomness injected)
      ▼
src/visualizer/    pure TS: board state + commands; turns engine output
      │            into runs (per-cell reveal ticks)
      │     src/player/   pure TS: a playhead moving over ticks in time
      ▼            ▼
src/components/    React: canvas renderer = f(snapshot, tick), input,
                   controls
```

Each layer turns its input into data, and the next layer decides what to
do with it. The engine never knows it's being animated: it returns events
or wall placements. The visualizer turns those into a _run_, and the
player only moves a number (the playhead tick). The renderer draws
whatever that number says. So the algorithms are testable in isolation,
playback needs no timers, and other views (a side-by-side "race" of
several algorithms, a 3D view) can reuse the same runs.

## Runs and playback

A run records, for every cell, the tick at which it appears (or `NEVER`):

- search runs: `discoverTick` (discovery order: tick 0, 1, 2, …), then
  `pathTick` for interior path cells, after the last discovery
- maze runs: `wallTick` (walls that share a tick appear together)

A cell is visible at playhead `t` once its tick is below `t`, and its
entrance animation runs over the next `rate × 0.35` ticks. So any frame,
forwards or backwards, is a pure function of the board snapshot and `t`
(`cellLayer()` / `drawBoard()` in `src/components/board-renderer.ts`).
The `Player` advances `t` from `requestAnimationFrame` timestamps; pause,
step, scrub and speed changes only move or re-rate that number.

A run is computed in full the moment it starts, so interrupting one is
always safe. The grid already contains the whole maze when its animation
begins, which is why "Visualize" mid-build simply searches the finished
maze. After a search, editing the board re-runs it instantly without
animation, so the path follows the edit live.

## Races

A snapshot holds a list of runs: none, one (a search or a maze build), or
one search per algorithm in a race. All runs share the one playhead, and
every search run's tick `k` is its `k`-th discovered cell, so playback
advances every racer by exactly one cell per tick. That's what makes the
race fair: finishing first means finding the goal after exploring the
fewest cells. The snapshot also carries `bestCost` (from a Dijkstra run)
so the UI can say whether each racer's path is actually the cheapest.
Editing the board during or after a race re-runs every racer.

## Share links

`src/visualizer/share.ts` encodes the board and the algorithm choice into
the URL fragment: `#v=1&b=<board>&m=explore|race&a=<ids>`. The board is
base64url bytes (a header with version, size and start/goal, then one
bit per cell for walls and one for weighted terrain), about 480
characters for a 26×53 board. Nothing is sent to a server: the fragment
never leaves the browser.

A link is untrusted input, so decoding is strict and total:

- it never throws;
- it rejects oversized input before parsing, and anything not exactly
  matching the layout (length, padding bits, version);
- it enforces the size limits (5 to 200 cells per side, at most 20,000
  cells), and requires distinct open start/goal cells, no cell that is both wall and weighted, and known, distinct
  algorithms (1 for explore, 2–4 for a race).

It is fuzz-tested with random strings and random mutations of valid
links. The page reads the link once on load and again on `hashchange`;
a bad link shows a notice and falls back to a fresh board. Once the board
is edited, the page drops the link from the address bar, since reloading
would bring back the old board. `Visualizer.boardRevision` counts board
edits only, so replaying the link's own run keeps it.

## Rendering and input

The board is one `<canvas>` per run on screen. Each frame fills settled
cells in one path per color. Visited cells take one of 24 colors along
a near→far ramp by discovery order, so they still batch into a few dozen
`fill()` calls instead of one per cell. A full 1,378-cell frame at 2×
pixel density took a median of 3.1 ms (95th percentile 5.2 ms) in Chrome,
over 300 frames of a Dijkstra run through a maze in a dev build. That's a
one-off measurement (2026-09-23), not a tracked benchmark: `npm run bench`
covers the engine, not rendering.
The canvas sits in an absolutely positioned layer, so its size
never feeds back into the container it's fitted to. Redraws
are coalesced to one per animation frame and happen only when the
snapshot or playhead changes. Pointer Events (mouse, touch and pen)
become `Visualizer` gestures. Pointer events arrive about once a frame,
so a fast drag jumps cells; `cellsBetween()` fills in the cells between
consecutive events so strokes are unbroken. A dragged marker only covers
the cell under it and puts back any wall or weight once it moves on; only
the cell it's dropped on is cleared. The canvas is also
keyboard-operable: arrow keys move a cursor, Space paints or erases, and
Space on S/G picks it up and drops it. A polite live region announces the
cursor's cell.

For screen readers, the run statistics and race standings are plain
labeled regions (they change every frame). A separate polite live region
announces each phase once: exploring, path found (with cost and whether
it's the shortest), or no path, and the race result when all racers
finish.

With `prefers-reduced-motion`, entrance animations are skipped: cells
appear settled, and playback still steps cell by cell.

## The 3D view

The 3D view (`src/components/board-3d/`) is a second renderer over the
same data. Each cell's `cellLayer()`, the same function the 2D renderer
uses, maps to a box height and color (`cellPose()`). Walls grow up out
of the floor, visited cells ripple up and settle, and the path rises
under a glowing tube. So the two views always agree, and scrubbing works
identically.

- **One draw call for the board.** Every cell is an instance of one
  rounded-box `InstancedMesh`; a frame rewrites the instance matrices and
  colors. Update plus render took a median of about 2 ms in Chrome for a
  1,378-cell board (a one-off measurement, 2026-09-24).
- **Renders on demand.** The view redraws only when the board, the
  playhead, the camera or the size changes, and keeps going only while
  orbit damping is still gliding.
- **Framing.** On every resize the camera moves along its viewing
  direction to the closest distance at which all board corners project
  inside the viewport, found by binary search since the fit is monotonic
  in distance.
- **Loaded only when used.** `React.lazy` puts three.js in its own chunk
  (about 145 kB gzipped); 2D-only visitors never download it.
- **Fails safely.** Without WebGL it shows a message instead. An error
  boundary contains a failed context or a chunk that won't load, with
  "Try again". A lost context (GPU reset) offers a restart. Each scene
  gets a fresh canvas, and its context is released on dispose, because
  browsers cap live WebGL contexts.

It's a viewing mode: drag orbits and the wheel zooms. The canvas is
focusable, so arrow keys pan and Shift+arrow keys rotate. Editing stays in
2D, where a pointer maps to a cell unambiguously.

The whole app also sits in an error boundary (`App.tsx`), so an
unexpected error shows "Try again / Reload page" instead of a blank page.

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
4. In `src/components/algorithm-guides.ts`, add its pseudocode and
   explanation to `ALGORITHM_GUIDES` (mirroring its spec) and a short name
   to `SHORT_LABELS`. Both are keyed by `PathAlgorithmId`, so TypeScript
   fails the build until you do.

Everything else follows from `PATH_ALGORITHMS`: the sidebar's algorithm
menu, the race picker, share-link validation, and the e2e and property
tests.

## Maze generation

`generateMaze(problem, algorithm, random?)` returns `WallPlacement[]`:
`{ index, tick }` sorted by `tick`, one per walled cell. The tick is the
animation step the wall appears on, and several walls can share one:
Recursive Division's sibling regions and the outer border all build in
parallel. Playback advances through ticks at the Player's rate. Passing
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
- **Model tests** cover the `Visualizer` (commands, gestures, live
  re-run), including a property test that any random sequence of edits,
  runs, frames and resets leaves a consistent board whose on-screen search
  matches a fresh search. The `Player` is tested frame by frame with a
  fake clock.
- **Component tests** (Testing Library, jsdom) drive the real UI through a
  fake clock injected via `createVisualizer`: pointer and keyboard input
  on the canvas, playback controls, resets mid-animation. jsdom can't
  draw, so drawing is tested against a recording fake 2D context
  (`board-renderer.test.ts`).
- **End-to-end tests** (Playwright, `e2e/`) run against the production
  build: real layout, canvas pixels (exact colors at cell centers, not
  screenshot diffs), WebGL, the lazy 3D chunk, the CSP, and a phone-sized
  touch device. Every test also fails on any console error, exception or
  CSP violation. `e2e/a11y.spec.ts` runs axe (WCAG 2.1 A/AA) on each
  major UI state.
- **Build and docs checks:** `scripts/check-bundle.mjs` enforces gzipped
  size budgets and keeps three.js out of the main bundle;
  `scripts/check-docs.mjs` fails when the Markdown docs reference a path,
  npm script or identifier that doesn't exist.
- **Mutation checks:** a test isn't trusted until breaking the code it
  guards makes it fail. That's how the maze-connectivity, live re-run,
  3D-retry and CSP tests were confirmed.

History note: the engine replaced `src/algorithms/`. Before that code was
deleted (commit "Remove the pre-engine algorithms and document the
architecture"), comparison tests showed BFS/DFS, all maze generators and
the path-segment drawing matched it exactly (commit "Add a pure-TypeScript
engine for pathfinding and maze generation"). The property tests also
found that the old A* wasn't optimal (commit "Add property-based
pathfinding tests; they expose an A* optimality bug"). One deliberate
difference since then: when start or goal sits on the outer border, mazes
now route it into the interior, where the old generator could wall it in
(found by an independent audit; see `anchorRoute` in `mazes.ts`).
