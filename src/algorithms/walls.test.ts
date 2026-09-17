import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { recursiveDivision, recursiveDivisionTwoLayers } from './walls';
import { unweightedSearch } from './paths';
import type { CoordinateAndDirection } from '../models/models';

function coord(row: number, column: number): CoordinateAndDirection {
  return { row, column, direction: '' };
}

// unweightedSearch's returned path is computed synchronously; the animation
// harness just needs to satisfy the signature.
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

// recursiveDivision/recursiveDivisionTwoLayers stage their wall placements
// through setTimeout (to animate them in the UI) - fake timers let a test
// flush every pending wall placement synchronously.
function collectWalls(build: (buildWall: (row: number, column: number) => void) => void): Set<string> {
  vi.useFakeTimers();
  const walls = new Set<string>();
  build((row, column) => walls.add(`${row}_${column}`));
  vi.runAllTimers();
  vi.useRealTimers();
  return walls;
}

describe('recursive division maze generation', () => {
  const rows = 15;
  const columns = 15;

  // Mirrors configurations.tsx's randomStartCoordinate/randomGoalCoordinate:
  // one cell inside the outer border (row rows-2 / row 1), not on a corner
  // and not on the border itself - a border cell only has 2-3 real
  // neighbors, which let the maze wall it in completely even under a
  // connectivity guarantee that assumes 4 neighbors. Using the app's real
  // placement pattern here is what makes this test meaningful.
  const start = coord(rows - 2, 3);
  const goal = coord(1, columns - 4);

  const TRIALS = 30;

  it.each(Array.from({ length: TRIALS }, (_, i) => i))(
    'recursiveDivision (single-thickness) leaves start and goal reachable (trial %i)',
    () => {
      const walls = collectWalls((buildWall) =>
        recursiveDivision(0, start, goal, rows, columns, 1, 1, rows - 2, columns - 2, buildWall)
      );

      const { scheduleTimeout, animationCallbacks } = createAnimationHarness();
      const path = unweightedSearch(rows, columns, start, goal, walls, 'BreadthFirstSearch', scheduleTimeout, animationCallbacks);

      expect(path).not.toBeNull();
    }
  );

  it.each(Array.from({ length: TRIALS }, (_, i) => i))(
    'recursiveDivisionTwoLayers (double-thickness) leaves start and goal reachable (trial %i)',
    () => {
      const walls = collectWalls((buildWall) =>
        recursiveDivisionTwoLayers(0, start, goal, rows, columns, 1, 1, rows - 2, columns - 2, buildWall)
      );

      const { scheduleTimeout, animationCallbacks } = createAnimationHarness();
      const path = unweightedSearch(rows, columns, start, goal, walls, 'BreadthFirstSearch', scheduleTimeout, animationCallbacks);

      expect(path).not.toBeNull();
    }
  );

  it('never places a wall directly on the start or goal cell', () => {
    // A single deterministic seed is fine here - this checks the
    // exclusion-zone logic's own bookkeeping, not connectivity, so it
    // doesn't need repeated-trial coverage the way reachability does.
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const walls = collectWalls((buildWall) =>
      recursiveDivision(0, start, goal, rows, columns, 1, 1, rows - 2, columns - 2, buildWall)
    );
    vi.restoreAllMocks();

    expect(walls.has(`${start.row}_${start.column}`)).toBe(false);
    expect(walls.has(`${goal.row}_${goal.column}`)).toBe(false);
  });
});
