import { describe, it, expect } from 'vitest';
import { unweightedSearch, weightedSearch } from './paths';
import type { CoordinateAndDirection } from '../models/models';

// The algorithms only use scheduleTimeout/callbacks for the visual-fill
// animation - the returned path itself is computed synchronously, so a
// harness that just invokes callbacks immediately (ignoring delay) is
// enough for these tests, and incidentally still exercises the callback
// bodies rather than skipping them entirely.
function createAnimationHarness() {
  return {
    scheduleTimeout: (callback: () => void) => {
      callback();
    },
    animationCallbacks: {
      onCellVisited: () => {},
      onGoalPathFill: () => {},
      onPathDirection: () => {},
    },
  };
}

function coord(row: number, column: number): CoordinateAndDirection {
  return { row, column, direction: '' };
}

// A path's returned shape is [start, ...intermediate cells..., goal] with
// each consecutive pair differing by exactly one cell in one direction.
function assertValidPath(path: CoordinateAndDirection[] | null, start: CoordinateAndDirection, goal: CoordinateAndDirection) {
  expect(path).not.toBeNull();
  const p = path as CoordinateAndDirection[];
  expect(p[0]).toMatchObject({ row: start.row, column: start.column });
  expect(p[p.length - 1]).toMatchObject({ row: goal.row, column: goal.column });

  for (let i = 1; i < p.length; i++) {
    const dr = Math.abs(p[i].row - p[i - 1].row);
    const dc = Math.abs(p[i].column - p[i - 1].column);
    expect(dr + dc).toBe(1);
  }
}

describe('pathfinding algorithms on an open grid', () => {
  const rows = 10;
  const columns = 10;
  const start = coord(0, 0);
  const goal = coord(9, 9);
  const noWalls = new Set<string>();
  const noWeights = new Map<string, number>();

  it('Breadth-first Search finds a valid path', () => {
    const { scheduleTimeout, animationCallbacks } = createAnimationHarness();
    const path = unweightedSearch(rows, columns, start, goal, noWalls, 'BreadthFirstSearch', scheduleTimeout, animationCallbacks);
    assertValidPath(path, start, goal);
  });

  it('Depth-first Search finds a valid (if not necessarily shortest) path', () => {
    const { scheduleTimeout, animationCallbacks } = createAnimationHarness();
    const path = unweightedSearch(rows, columns, start, goal, noWalls, 'DepthFirstSearch', scheduleTimeout, animationCallbacks);
    assertValidPath(path, start, goal);
  });

  it("Dijkstra's Algorithm finds a valid path", () => {
    const { scheduleTimeout, animationCallbacks } = createAnimationHarness();
    const path = weightedSearch(rows, columns, start, goal, noWalls, noWeights, 'DijkstrasAlgorithm', scheduleTimeout, animationCallbacks);
    assertValidPath(path, start, goal);
  });

  it('A* Algorithm finds a valid path', () => {
    const { scheduleTimeout, animationCallbacks } = createAnimationHarness();
    const path = weightedSearch(rows, columns, start, goal, noWalls, noWeights, 'AStarAlgorithm', scheduleTimeout, animationCallbacks);
    assertValidPath(path, start, goal);
  });

  it('Greedy Best-first Search finds a valid path', () => {
    const { scheduleTimeout, animationCallbacks } = createAnimationHarness();
    const path = weightedSearch(rows, columns, start, goal, noWalls, noWeights, 'GreedyBestFirstSearch', scheduleTimeout, animationCallbacks);
    assertValidPath(path, start, goal);
  });

  it('BFS, Dijkstra, and A* all agree on the shortest path length on an unweighted grid', () => {
    // Regression test for the getEuclideanDistance admissibility fix: before
    // the fix, A*'s squared-distance heuristic could overestimate the true
    // cost and return a longer-than-shortest path.
    const bfsHarness = createAnimationHarness();
    const dijkstraHarness = createAnimationHarness();
    const aStarHarness = createAnimationHarness();

    const bfs = unweightedSearch(rows, columns, start, goal, noWalls, 'BreadthFirstSearch', bfsHarness.scheduleTimeout, bfsHarness.animationCallbacks);
    const dijkstra = weightedSearch(rows, columns, start, goal, noWalls, noWeights, 'DijkstrasAlgorithm', dijkstraHarness.scheduleTimeout, dijkstraHarness.animationCallbacks);
    const aStar = weightedSearch(rows, columns, start, goal, noWalls, noWeights, 'AStarAlgorithm', aStarHarness.scheduleTimeout, aStarHarness.animationCallbacks);

    expect(bfs).not.toBeNull();
    expect(dijkstra).not.toBeNull();
    expect(aStar).not.toBeNull();
    expect(dijkstra?.length).toBe(bfs?.length);
    expect(aStar?.length).toBe(bfs?.length);
  });

  it('weighted terrain makes Dijkstra/A* detour around it, while BFS ignores weight entirely', () => {
    // A straight horizontal corridor from (5,0) to (5,9), with every cell
    // in it marked expensive - Dijkstra/A* (cost-aware) should route around
    // it via a longer-but-cheaper path, while BFS (weight-blind, fewest
    // steps only) should still walk straight through it.
    const rowStart = coord(5, 0);
    const rowGoal = coord(5, 9);
    const weights = new Map<string, number>();
    for (let c = 1; c < 9; c++) {
      weights.set(`5_${c}`, 100);
    }

    const bfsHarness = createAnimationHarness();
    const dijkstraHarness = createAnimationHarness();
    const aStarHarness = createAnimationHarness();

    const bfs = unweightedSearch(rows, columns, rowStart, rowGoal, noWalls, 'BreadthFirstSearch', bfsHarness.scheduleTimeout, bfsHarness.animationCallbacks);
    const dijkstra = weightedSearch(rows, columns, rowStart, rowGoal, noWalls, weights, 'DijkstrasAlgorithm', dijkstraHarness.scheduleTimeout, dijkstraHarness.animationCallbacks);
    const aStar = weightedSearch(rows, columns, rowStart, rowGoal, noWalls, weights, 'AStarAlgorithm', aStarHarness.scheduleTimeout, aStarHarness.animationCallbacks);

    assertValidPath(bfs, rowStart, rowGoal);
    assertValidPath(dijkstra, rowStart, rowGoal);
    assertValidPath(aStar, rowStart, rowGoal);

    // BFS takes the shortest-by-steps route: straight across row 5, 9 steps.
    expect((bfs as CoordinateAndDirection[]).length).toBe(10);

    // Dijkstra/A* detour off row 5 to avoid the weighted cells - their paths
    // are longer in step count but cheaper in total cost, and each visits
    // at most the two unavoidable weighted endpoints-adjacent cells (not
    // the 8 interior weighted cells BFS walks straight through).
    const weightedCellsOnPath = (path: CoordinateAndDirection[] | null) =>
      (path as CoordinateAndDirection[]).filter((p) => weights.has(`${p.row}_${p.column}`)).length;

    expect(weightedCellsOnPath(dijkstra)).toBeLessThan(weightedCellsOnPath(bfs));
    expect(weightedCellsOnPath(aStar)).toBeLessThan(weightedCellsOnPath(bfs));
    expect((dijkstra as CoordinateAndDirection[]).length).toBeGreaterThan((bfs as CoordinateAndDirection[]).length);
  });

  it('returns null when the goal is completely walled off', () => {
    const walls = new Set<string>();
    // Seal off a 1x1 pocket around a goal in the interior so it's unreachable.
    const sealedGoal = coord(5, 5);
    walls.add('4_5');
    walls.add('6_5');
    walls.add('5_4');
    walls.add('5_6');

    const { scheduleTimeout, animationCallbacks } = createAnimationHarness();
    const path = unweightedSearch(rows, columns, start, sealedGoal, walls, 'BreadthFirstSearch', scheduleTimeout, animationCallbacks);
    expect(path).toBeNull();
  });
});
