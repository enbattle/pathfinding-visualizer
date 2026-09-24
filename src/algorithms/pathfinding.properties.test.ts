import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { unweightedSearch, weightedSearch } from './paths';
import type { CoordinateAndDirection } from '../models/models';
import {
  assertValidPath,
  gridProblemArbitrary,
  pathCost,
  referenceShortestCost,
  type GridProblem,
} from '../test-support/grid-problems';

type AlgorithmId =
  | 'BreadthFirstSearch'
  | 'DepthFirstSearch'
  | 'GreedyBestFirstSearch'
  | 'DijkstrasAlgorithm'
  | 'AStarAlgorithm';

// Adapts the current string-keyed, callback-driven API to "problem in,
// path of cell indices (or null) out".
function solve(problem: GridProblem, algorithm: AlgorithmId): number[] | null {
  const { columns } = problem;
  const toCoord = (index: number): CoordinateAndDirection => ({
    row: Math.floor(index / columns),
    column: index % columns,
    direction: '',
  });
  const walls = new Set<string>();
  const weights = new Map<string, number>();
  problem.walls.forEach((isWall, index) => {
    const { row, column } = toCoord(index);
    if (isWall) walls.add(`${row}_${column}`);
    if (problem.weights[index] !== 1)
      weights.set(`${row}_${column}`, problem.weights[index]);
  });
  const schedule = () => {};
  const callbacks = {
    onCellVisited: () => {},
    onGoalPathFill: () => {},
    onPathDirection: () => {},
  };
  const start = toCoord(problem.start);
  const goal = toCoord(problem.goal);

  const path =
    algorithm === 'BreadthFirstSearch' || algorithm === 'DepthFirstSearch'
      ? unweightedSearch(
          problem.rows,
          columns,
          start,
          goal,
          walls,
          algorithm,
          schedule,
          callbacks
        )
      : weightedSearch(
          problem.rows,
          columns,
          start,
          goal,
          walls,
          weights,
          algorithm,
          schedule,
          callbacks
        );
  return path && path.map(({ row, column }) => row * columns + column);
}

const ALL_ALGORITHMS: AlgorithmId[] = [
  'BreadthFirstSearch',
  'DepthFirstSearch',
  'GreedyBestFirstSearch',
  'DijkstrasAlgorithm',
  'AStarAlgorithm',
];

const RUNS = { numRuns: 500 };

describe('pathfinding properties (random grids)', () => {
  it.each(ALL_ALGORITHMS)(
    '%s finds a path exactly when one exists, and it is a valid walk',
    algorithm => {
      fc.assert(
        fc.property(gridProblemArbitrary(), problem => {
          const path = solve(problem, algorithm);
          const reachable = referenceShortestCost(problem) < Infinity;
          expect(path !== null).toBe(reachable);
          if (path) assertValidPath(problem, path);
        }),
        RUNS
      );
    }
  );

  it('BreadthFirstSearch finds a fewest-steps path (it ignores terrain weight by design)', () => {
    fc.assert(
      fc.property(gridProblemArbitrary(), problem => {
        const path = solve(problem, 'BreadthFirstSearch');
        if (!path) return;
        expect(path.length - 1).toBe(
          referenceShortestCost(problem, { ignoreWeights: true })
        );
      }),
      RUNS
    );
  });

  it('DijkstrasAlgorithm finds a lowest-cost path', () => {
    fc.assert(
      fc.property(gridProblemArbitrary(), problem => {
        const path = solve(problem, 'DijkstrasAlgorithm');
        if (!path) return;
        expect(pathCost(problem, path)).toBe(referenceShortestCost(problem));
      }),
      RUNS
    );
  });

  // KNOWN BUG (fixed by the src/engine rewrite): paths.tsx computes each
  // child's A* priority from the parent's *priority* (g + h) rather than
  // its cost-so-far (g), so heuristic values accumulate along the path and
  // A* stops being optimal. Minimal counterexample fast-check found: a
  // 10x6 grid where it returns a cost-7 path next to a cost-5 one.
  it.fails('AStarAlgorithm finds a lowest-cost path', () => {
    fc.assert(
      fc.property(gridProblemArbitrary(), problem => {
        const path = solve(problem, 'AStarAlgorithm');
        if (!path) return;
        expect(pathCost(problem, path)).toBe(referenceShortestCost(problem));
      }),
      RUNS
    );
  });
});
