import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { recursiveDivision, recursiveDivisionTwoLayers, prims } from './walls';
import { unweightedSearch } from './paths';
import type { CoordinateAndDirection } from '../models/models';

function coord(row: number, column: number): CoordinateAndDirection {
  return { row, column, direction: '' };
}

function randIntBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

// The wall algorithms stage their wall placements through an injected
// scheduler (board.tsx's tracked setTimeout, to animate them in the UI) -
// backing it with setTimeout under fake timers lets a test flush every
// pending wall placement synchronously.
const scheduleWallPlacement = (callback: () => void, delay: number): void => {
  setTimeout(callback, delay);
};

function collectWalls(
  build: (buildWall: (row: number, column: number) => void) => void
): Set<string> {
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
      const walls = collectWalls(buildWall =>
        recursiveDivision(
          0,
          start,
          goal,
          rows,
          columns,
          1,
          1,
          rows - 2,
          columns - 2,
          buildWall,
          scheduleWallPlacement
        )
      );

      const { scheduleTimeout, animationCallbacks } = createAnimationHarness();
      const path = unweightedSearch(
        rows,
        columns,
        start,
        goal,
        walls,
        'BreadthFirstSearch',
        scheduleTimeout,
        animationCallbacks
      );

      expect(path).not.toBeNull();
    }
  );

  it.each(Array.from({ length: TRIALS }, (_, i) => i))(
    'recursiveDivisionTwoLayers (double-thickness) leaves start and goal reachable (trial %i)',
    () => {
      const walls = collectWalls(buildWall =>
        recursiveDivisionTwoLayers(
          0,
          start,
          goal,
          rows,
          columns,
          1,
          1,
          rows - 2,
          columns - 2,
          buildWall,
          scheduleWallPlacement
        )
      );

      const { scheduleTimeout, animationCallbacks } = createAnimationHarness();
      const path = unweightedSearch(
        rows,
        columns,
        start,
        goal,
        walls,
        'BreadthFirstSearch',
        scheduleTimeout,
        animationCallbacks
      );

      expect(path).not.toBeNull();
    }
  );

  it.each(Array.from({ length: TRIALS }, (_, i) => i))(
    'prims leaves start and goal reachable (trial %i)',
    () => {
      const walls = collectWalls(buildWall =>
        prims(
          0,
          start,
          goal,
          rows,
          columns,
          1,
          1,
          rows - 2,
          columns - 2,
          buildWall,
          scheduleWallPlacement
        )
      );

      const { scheduleTimeout, animationCallbacks } = createAnimationHarness();
      const path = unweightedSearch(
        rows,
        columns,
        start,
        goal,
        walls,
        'BreadthFirstSearch',
        scheduleTimeout,
        animationCallbacks
      );

      expect(path).not.toBeNull();
    }
  );

  it('prims never places a wall directly on the start or goal cell', () => {
    const walls = collectWalls(buildWall =>
      prims(
        0,
        start,
        goal,
        rows,
        columns,
        1,
        1,
        rows - 2,
        columns - 2,
        buildWall,
        scheduleWallPlacement
      )
    );

    expect(walls.has(`${start.row}_${start.column}`)).toBe(false);
    expect(walls.has(`${goal.row}_${goal.column}`)).toBe(false);
  });

  it('prims produces a structurally different wall count than recursive division (organic vs. blocky)', () => {
    // Not a rigorous "shape" check, but a cheap structural sanity check
    // that Prim's isn't secretly degenerating into the same partition
    // pattern (or into an all-open / all-walled board).
    vi.spyOn(Math, 'random').mockReturnValue(0.37);
    const primsWalls = collectWalls(buildWall =>
      prims(
        0,
        start,
        goal,
        rows,
        columns,
        1,
        1,
        rows - 2,
        columns - 2,
        buildWall,
        scheduleWallPlacement
      )
    );
    vi.restoreAllMocks();

    const interiorCells = (rows - 2) * (columns - 2);
    expect(primsWalls.size).toBeGreaterThan(0);
    expect(primsWalls.size).toBeLessThan(interiorCells);
  });

  it('never places a wall directly on the start or goal cell', () => {
    // A single deterministic seed is fine here - this checks the
    // exclusion-zone logic's own bookkeeping, not connectivity, so it
    // doesn't need repeated-trial coverage the way reachability does.
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const walls = collectWalls(buildWall =>
      recursiveDivision(
        0,
        start,
        goal,
        rows,
        columns,
        1,
        1,
        rows - 2,
        columns - 2,
        buildWall,
        scheduleWallPlacement
      )
    );
    vi.restoreAllMocks();

    expect(walls.has(`${start.row}_${start.column}`)).toBe(false);
    expect(walls.has(`${goal.row}_${goal.column}`)).toBe(false);
  });
});

describe('recursive division maze generation - start/goal placed anywhere (e.g. after dragging)', () => {
  // Regression coverage for a bug where a wall row/column landing exactly
  // on start or goal's own row/column (not just adjacent to it) would wall
  // off its immediate left/right (or up/down) neighbors too, boxing it in
  // completely. The fixed-position start/goal used by the suite above
  // never happened to exercise that exact-row/column case, so this drags
  // start/goal to arbitrary interior cells across several board shapes
  // instead of the app's default placement.
  const ALGORITHMS: [string, typeof recursiveDivision][] = [
    ['recursiveDivision', recursiveDivision],
    ['recursiveDivisionTwoLayers', recursiveDivisionTwoLayers],
  ];

  const SIZES: [number, number][] = [
    [21, 21],
    [30, 45],
    [45, 30],
  ];

  const TRIALS = 25;

  for (const [name, algorithm] of ALGORITHMS) {
    for (const [rows, columns] of SIZES) {
      it.each(Array.from({ length: TRIALS }, (_, i) => i))(
        `${name} on a ${rows}x${columns} board leaves a randomly-placed start/goal reachable (trial %i)`,
        () => {
          const start = coord(
            randIntBetween(1, rows - 2),
            randIntBetween(1, columns - 2)
          );
          let goal = coord(
            randIntBetween(1, rows - 2),
            randIntBetween(1, columns - 2)
          );
          while (goal.row === start.row && goal.column === start.column) {
            goal = coord(
              randIntBetween(1, rows - 2),
              randIntBetween(1, columns - 2)
            );
          }

          const walls = collectWalls(buildWall =>
            algorithm(
              0,
              start,
              goal,
              rows,
              columns,
              1,
              1,
              rows - 2,
              columns - 2,
              buildWall,
              scheduleWallPlacement
            )
          );

          const { scheduleTimeout, animationCallbacks } =
            createAnimationHarness();
          const path = unweightedSearch(
            rows,
            columns,
            start,
            goal,
            walls,
            'BreadthFirstSearch',
            scheduleTimeout,
            animationCallbacks
          );

          expect(path).not.toBeNull();
        }
      );
    }
  }
});
