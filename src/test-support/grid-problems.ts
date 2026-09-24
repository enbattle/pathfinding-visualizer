// Shared, solver-agnostic fixtures for property-based pathfinding tests:
// a fast-check generator for random grid problems, plus deliberately naive
// reference solvers used as the test oracle. The oracles share no code with
// the app's algorithms (no heap, no frontier abstraction) so a bug in those
// can't also hide in the thing checking them.
import fc from 'fast-check';
// Only the cost constant comes from the engine; the oracles below share no
// code with it.
import { WEIGHTED_TERRAIN_COST } from '../engine';

// A grid problem in the simplest possible encoding: flat row-major arrays,
// index = row * columns + column.
export interface GridProblem {
  rows: number;
  columns: number;
  walls: boolean[];
  // Cost of *entering* each cell (1 = normal, >1 = weighted terrain).
  weights: number[];
  start: number;
  goal: number;
}

// The weighted-terrain cost the app paints (WEIGHTED_TERRAIN_COST).
export const WEIGHTED_COST = WEIGHTED_TERRAIN_COST;

export interface GridProblemOptions {
  maxSize?: number;
  weighted?: boolean;
}

export function gridProblemArbitrary({
  maxSize = 12,
  weighted = true,
}: GridProblemOptions = {}): fc.Arbitrary<GridProblem> {
  return fc
    .record({
      rows: fc.integer({ min: 1, max: maxSize }),
      columns: fc.integer({ min: 2, max: maxSize }),
    })
    .chain(({ rows, columns }) => {
      const size = rows * columns;
      return fc
        .record({
          // ~30% walls: dense enough that unreachable goals and winding
          // paths are common, sparse enough that most goals stay reachable.
          walls: fc.array(fc.integer({ min: 0, max: 9 }), {
            minLength: size,
            maxLength: size,
          }),
          weights: fc.array(
            weighted ? fc.constantFrom(1, 1, 1, WEIGHTED_COST) : fc.constant(1),
            { minLength: size, maxLength: size }
          ),
          start: fc.integer({ min: 0, max: size - 1 }),
          goal: fc.integer({ min: 0, max: size - 1 }),
        })
        .filter(({ start, goal }) => start !== goal)
        .map(({ walls, weights, start, goal }) => {
          const wallFlags = walls.map(roll => roll < 3);
          // Start/goal are never walls in the app (it won't let you place
          // one there), and are never weighted terrain either.
          wallFlags[start] = false;
          wallFlags[goal] = false;
          weights[start] = 1;
          weights[goal] = 1;
          return { rows, columns, walls: wallFlags, weights, start, goal };
        });
    });
}

export function neighborsOf(problem: GridProblem, index: number): number[] {
  const { rows, columns } = problem;
  const row = Math.floor(index / columns);
  const column = index % columns;
  const result: number[] = [];
  if (row > 0) result.push(index - columns);
  if (column < columns - 1) result.push(index + 1);
  if (row < rows - 1) result.push(index + columns);
  if (column > 0) result.push(index - 1);
  return result;
}

// Textbook O(V^2) Dijkstra - no heap, just a linear scan for the cheapest
// unsettled cell. Returns the minimum total cost of reaching the goal
// (sum of entered cells' weights), or Infinity if it's unreachable.
export function referenceShortestCost(
  problem: GridProblem,
  { ignoreWeights = false }: { ignoreWeights?: boolean } = {}
): number {
  const size = problem.rows * problem.columns;
  const cost = new Array<number>(size).fill(Infinity);
  const settled = new Array<boolean>(size).fill(false);
  cost[problem.start] = 0;

  for (;;) {
    let current = -1;
    for (let i = 0; i < size; i++) {
      if (
        !settled[i] &&
        cost[i] < Infinity &&
        (current === -1 || cost[i] < cost[current])
      ) {
        current = i;
      }
    }
    if (current === -1) return Infinity;
    if (current === problem.goal) return cost[current];
    settled[current] = true;

    for (const next of neighborsOf(problem, current)) {
      if (problem.walls[next]) continue;
      const step = ignoreWeights ? 1 : problem.weights[next];
      if (cost[current] + step < cost[next]) cost[next] = cost[current] + step;
    }
  }
}

// Sum of the weights of every cell entered along `path` (so excluding the
// start cell itself) - the quantity Dijkstra/A* minimize.
export function pathCost(problem: GridProblem, path: number[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += problem.weights[path[i]];
  return total;
}

// Throws (so fast-check can shrink to a minimal counterexample) unless
// `path` is a real walk from start to goal: correct endpoints, every step
// to a 4-neighbor, never through a wall, never revisiting a cell.
export function assertValidPath(problem: GridProblem, path: number[]): void {
  if (path[0] !== problem.start)
    throw new Error(`path starts at ${path[0]}, not start ${problem.start}`);
  if (path[path.length - 1] !== problem.goal) {
    throw new Error(
      `path ends at ${path[path.length - 1]}, not goal ${problem.goal}`
    );
  }
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    if (seen.has(path[i])) throw new Error(`path revisits cell ${path[i]}`);
    seen.add(path[i]);
    if (problem.walls[path[i]])
      throw new Error(`path passes through wall ${path[i]}`);
    if (i > 0 && !neighborsOf(problem, path[i - 1]).includes(path[i])) {
      throw new Error(
        `step ${path[i - 1]} -> ${path[i]} isn't between neighboring cells`
      );
    }
  }
}
