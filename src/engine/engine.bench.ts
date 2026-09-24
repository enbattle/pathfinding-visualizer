// @vitest-environment node
// Engine throughput on a large board (100x100 = 10,000 cells, ~7x the
// app's default). Run with `npm run bench`. CI runs these for a report,
// not as a gate: timings on shared runners vary too much to fail builds
// on small changes.
//
// Absolute numbers are an upper bound. Vitest's module runner routes
// every cross-module call (e.g. pathfinding.ts -> grid.ts neighbors())
// through a getter, which the production bundle inlines away; Vitest
// warns about this ("accessed module export getters too many times").
// Compare algorithms and runs of this suite with each other, not with
// in-app timings.
import { describe, test } from 'vitest';
import { createGrid, generateMaze, runSearch, seededRandom } from './index';
import { MAZE_ALGORITHMS } from './mazes';
import { PATH_ALGORITHMS, type SearchProblem } from './pathfinding';

const SIZE = 100;
const START = (SIZE - 2) * SIZE + 1; // bottom-left, inside the border
const GOAL = SIZE + (SIZE - 2); // top-right, inside the border

const open: SearchProblem = {
  grid: createGrid(SIZE, SIZE),
  start: START,
  goal: GOAL,
};

const maze: SearchProblem = (() => {
  const grid = createGrid(SIZE, SIZE);
  const placements = generateMaze(
    { rows: SIZE, columns: SIZE, start: START, goal: GOAL },
    'recursive-division',
    seededRandom(1)
  );
  for (const { index } of placements) grid.walls[index] = 1;
  return { grid, start: START, goal: GOAL };
})();

describe(`engine on a ${SIZE}x${SIZE} board`, () => {
  test('search, open board, corner to corner', async ({ bench }) => {
    await bench.compare(
      ...PATH_ALGORITHMS.map(({ id }) =>
        bench(id, () => void runSearch(open, id))
      )
    );
  });

  test('search, recursive-division maze', async ({ bench }) => {
    await bench.compare(
      ...PATH_ALGORITHMS.map(({ id }) =>
        bench(id, () => void runSearch(maze, id))
      )
    );
  });

  test('maze generation', async ({ bench }) => {
    let seed = 0;
    await bench.compare(
      ...MAZE_ALGORITHMS.map(({ id }) =>
        bench(
          id,
          () =>
            void generateMaze(
              { rows: SIZE, columns: SIZE, start: START, goal: GOAL },
              id,
              seededRandom(seed++)
            )
        )
      )
    );
  });
});
