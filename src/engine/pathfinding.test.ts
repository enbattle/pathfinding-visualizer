import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createGrid, toIndex } from './grid';
import {
  PATH_ALGORITHMS,
  runSearch,
  search,
  type PathAlgorithmId,
  type SearchProblem,
} from './pathfinding';
import {
  assertValidPath,
  gridProblemArbitrary,
  pathCost,
  referenceShortestCost,
  type GridProblem,
} from '../test-support/grid-problems';

function toSearchProblem(problem: GridProblem): SearchProblem {
  const grid = createGrid(problem.rows, problem.columns);
  problem.walls.forEach((isWall, index) => {
    grid.walls[index] = isWall ? 1 : 0;
    grid.weights[index] = problem.weights[index];
  });
  return { grid, start: problem.start, goal: problem.goal };
}

const ALL: PathAlgorithmId[] = PATH_ALGORITHMS.map(algorithm => algorithm.id);
const RUNS = { numRuns: 500 };

describe('search properties (random grids)', () => {
  it.each(ALL)(
    '%s finds a path exactly when one exists, and it is a valid walk',
    algorithm => {
      fc.assert(
        fc.property(gridProblemArbitrary(), problem => {
          const { result } = runSearch(toSearchProblem(problem), algorithm);
          expect(result.path !== null).toBe(
            referenceShortestCost(problem) < Infinity
          );
          if (result.path) assertValidPath(problem, result.path);
        }),
        RUNS
      );
    }
  );

  it.each(ALL)(
    '%s reports the weighted cost of the path it returns',
    algorithm => {
      fc.assert(
        fc.property(gridProblemArbitrary(), problem => {
          const { result } = runSearch(toSearchProblem(problem), algorithm);
          expect(result.cost).toBe(
            result.path ? pathCost(problem, result.path) : Infinity
          );
        }),
        RUNS
      );
    }
  );

  it.each(
    PATH_ALGORITHMS.filter(a => a.optimality === 'always').map(a => a.id)
  )('%s finds a lowest-cost path', algorithm => {
    fc.assert(
      fc.property(gridProblemArbitrary(), problem => {
        const { result } = runSearch(toSearchProblem(problem), algorithm);
        if (result.path)
          expect(result.cost).toBe(referenceShortestCost(problem));
      }),
      RUNS
    );
  });

  it.each(
    PATH_ALGORITHMS.filter(a => a.optimality === 'unweighted').map(a => a.id)
  )('%s finds a fewest-steps path', algorithm => {
    fc.assert(
      fc.property(gridProblemArbitrary(), problem => {
        const { result } = runSearch(toSearchProblem(problem), algorithm);
        if (result.path) {
          expect(result.path.length - 1).toBe(
            referenceShortestCost(problem, { ignoreWeights: true })
          );
        }
      }),
      RUNS
    );
  });

  it.each(ALL)(
    '%s emits each discover/expand at most once, never for walls, and matches its counts',
    algorithm => {
      fc.assert(
        fc.property(gridProblemArbitrary(), problem => {
          const { events, result } = runSearch(
            toSearchProblem(problem),
            algorithm
          );
          const discovers = events
            .filter(e => e.type === 'discover')
            .map(e => e.index);
          const expands = events
            .filter(e => e.type === 'expand')
            .map(e => e.index);
          expect(new Set(discovers).size).toBe(discovers.length);
          expect(new Set(expands).size).toBe(expands.length);
          expect(discovers.length).toBe(result.discovered);
          expect(expands.length).toBe(result.expanded);
          for (const index of [...discovers, ...expands])
            expect(problem.walls[index]).toBe(false);
          expect(discovers).not.toContain(problem.start);
          expect(discovers).not.toContain(problem.goal);
        }),
        RUNS
      );
    }
  );

  it('A* never expands more cells than Dijkstra on unweighted grids', () => {
    // With a consistent heuristic A* only expands cells Dijkstra would
    // also expand before reaching the goal - the reason to prefer it.
    fc.assert(
      fc.property(gridProblemArbitrary({ weighted: false }), problem => {
        const searchProblem = toSearchProblem(problem);
        const astar = runSearch(searchProblem, 'astar').result;
        const dijkstra = runSearch(searchProblem, 'dijkstra').result;
        expect(astar.expanded).toBeLessThanOrEqual(dijkstra.expanded);
      }),
      RUNS
    );
  });
});

describe('search', () => {
  it('returns the start alone when start is the goal', () => {
    const grid = createGrid(3, 3);
    expect(runSearch({ grid, start: 4, goal: 4 }, 'astar').result).toEqual({
      path: [4],
      cost: 0,
      expanded: 0,
      discovered: 0,
    });
  });

  it('rejects start/goal outside the grid', () => {
    const grid = createGrid(3, 3);
    expect(() => runSearch({ grid, start: -1, goal: 4 }, 'bfs')).toThrow(
      RangeError
    );
    expect(() => runSearch({ grid, start: 0, goal: 9 }, 'bfs')).toThrow(
      RangeError
    );
    expect(() => runSearch({ grid, start: 0.5, goal: 4 }, 'bfs')).toThrow(
      RangeError
    );
  });

  it('can be stepped one event at a time', () => {
    const grid = createGrid(1, 4);
    const run = search({ grid, start: 0, goal: 3 }, 'bfs');
    expect(run.next().value).toEqual({ type: 'expand', index: 0 });
    expect(run.next().value).toEqual({ type: 'discover', index: 1 });
    expect(run.next().value).toEqual({ type: 'expand', index: 1 });
    expect(run.next().value).toEqual({ type: 'discover', index: 2 });
    expect(run.next().value).toEqual({ type: 'expand', index: 2 });
    const last = run.next();
    expect(last.done).toBe(true);
    expect(last.value).toMatchObject({ path: [0, 1, 2, 3], cost: 3 });
  });

  it('Dijkstra routes around weighted terrain that BFS walks straight through', () => {
    // 3x5, start/goal on the middle row, a weight-5 cell in between: the
    // straight line costs 1+5+1+1 = 8, the detour along row 0 costs 6.
    const grid = createGrid(3, 5);
    grid.weights[toIndex(grid, 1, 2)] = 5;
    const problem = {
      grid,
      start: toIndex(grid, 1, 0),
      goal: toIndex(grid, 1, 4),
    };
    expect(runSearch(problem, 'bfs').result.cost).toBe(8);
    expect(runSearch(problem, 'dijkstra').result.cost).toBe(6);
    expect(runSearch(problem, 'astar').result.cost).toBe(6);
  });
});

// A fixed board that shows how the algorithms differ, drawn as ASCII:
// '#' wall, '~' weighted terrain (cost 5), 'S'/'G' start/goal.
const BOARD = `
.........
.S..#....
....#.~~.
.####.~~.
......~~G
.........
`;

function parseBoard(board: string): SearchProblem {
  const lines = board.trim().split('\n');
  const grid = createGrid(lines.length, lines[0].length);
  let start = -1;
  let goal = -1;
  lines.forEach((line, row) =>
    [...line].forEach((cell, column) => {
      const index = toIndex(grid, row, column);
      if (cell === '#') grid.walls[index] = 1;
      if (cell === '~') grid.weights[index] = 5;
      if (cell === 'S') start = index;
      if (cell === 'G') goal = index;
    })
  );
  return { grid, start, goal };
}

// Same board with the result drawn on: '*' path, 'o' expanded but off the
// path; plus the result's numbers.
function renderResult(
  problem: SearchProblem,
  algorithm: PathAlgorithmId
): string {
  const { events, result } = runSearch(problem, algorithm);
  const { grid, start, goal } = problem;
  const onPath = new Set(result.path ?? []);
  const expanded = new Set(
    events.filter(e => e.type === 'expand').map(e => e.index)
  );
  const lines: string[] = [];
  for (let row = 0; row < grid.rows; row++) {
    let line = '';
    for (let column = 0; column < grid.columns; column++) {
      const index = toIndex(grid, row, column);
      if (index === start) line += 'S';
      else if (index === goal) line += 'G';
      else if (grid.walls[index]) line += '#';
      else if (onPath.has(index)) line += '*';
      else if (expanded.has(index)) line += 'o';
      else line += grid.weights[index] > 1 ? '~' : '.';
    }
    lines.push(line);
  }
  const summary = `cost ${result.cost}, ${result.path ? result.path.length : 0} cells, expanded ${result.expanded}`;
  return `\n${lines.join('\n')}\n${summary}\n`;
}

// Locks in each algorithm's exact exploration and path on one board, so any
// behavior change shows up as a readable diff in review. BFS/DFS output was
// proven identical to the pre-engine implementation (src/algorithms/
// paths.tsx, see git history) before it was removed. Only regenerate
// (vitest -u) for an intentional change.
describe('search snapshots', () => {
  it.each(ALL)('%s', algorithm => {
    expect(renderResult(parseBoard(BOARD), algorithm)).toMatchSnapshot();
  });
});
