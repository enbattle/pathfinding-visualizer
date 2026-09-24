import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import {
  drawBorderWalls,
  prims as oldPrims,
  recursiveDivision as oldRecursiveDivision,
  recursiveDivisionTwoLayers as oldRecursiveDivisionTwoLayers,
} from '../algorithms/walls';
import type { CoordinateAndDirection } from '../models/models';
import {
  generateMaze,
  MAZE_ALGORITHMS,
  type MazeAlgorithmId,
  type MazeProblem,
  type WallPlacement,
} from './mazes';
import { seededRandom } from './random';

const ALGORITHM_IDS = MAZE_ALGORITHMS.map(({ id }) => id);

const OLD_INTERIOR = {
  'recursive-division': oldRecursiveDivision,
  'recursive-division-thick': oldRecursiveDivisionTwoLayers,
  prims: oldPrims,
} satisfies Record<MazeAlgorithmId, unknown>;

// Runs the old timer-driven implementation exactly the way board.tsx's
// addRecursiveWalls does (border + interior, both from delay 0), with
// stepDelay 1 so each scheduled delay *is* the tick, and reduces the
// recorded placements to index -> earliest tick (the board ignored
// re-walling an already-walled cell).
function runOld(
  problem: MazeProblem,
  algorithm: MazeAlgorithmId,
  seed: number
): Map<number, number> {
  const { rows, columns } = problem;
  const toCoord = (index: number): CoordinateAndDirection => ({
    row: Math.floor(index / columns),
    column: index % columns,
    direction: '',
  });
  const start = toCoord(problem.start);
  const goal = toCoord(problem.goal);
  const earliest = new Map<number, number>();
  let pendingDelay = 0;
  const scheduleTimeout = (callback: () => void, delay: number): void => {
    pendingDelay = delay;
    callback();
  };
  const buildWall = (row: number, column: number): void => {
    const index = row * columns + column;
    const existing = earliest.get(index);
    if (existing === undefined || pendingDelay < existing) {
      earliest.set(index, pendingDelay);
    }
  };

  const spy = vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
  try {
    drawBorderWalls(start, goal, rows, columns, buildWall, scheduleTimeout, 1);
    OLD_INTERIOR[algorithm](
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
      scheduleTimeout,
      1
    );
  } finally {
    spy.mockRestore();
  }
  return earliest;
}

function toTickMap(placements: WallPlacement[]): Map<number, number> {
  return new Map(placements.map(({ index, tick }) => [index, tick]));
}

// The app's own placement pattern (configurations-helpers.ts): start one
// row above the bottom border in the left half, goal one row below the top
// border in the right half.
function appPlacement(
  rows: number,
  columns: number,
  seed: number
): MazeProblem {
  const random = seededRandom(seed ^ 0x9e3779b9);
  const between = (min: number, max: number) =>
    Math.floor(random() * (max - min + 1) + min);
  const startColumn = between(1, Math.floor(columns / 2));
  const goalColumn = between(Math.floor(columns / 2), columns - 2);
  return {
    rows,
    columns,
    start: (rows - 2) * columns + startColumn,
    goal: 1 * columns + goalColumn,
  };
}

// Anywhere strictly inside the border (e.g. after dragging), start !== goal.
function interiorPlacement(
  rows: number,
  columns: number,
  seed: number
): MazeProblem {
  const random = seededRandom(seed ^ 0x85ebca6b);
  const pick = () =>
    (1 + Math.floor(random() * (rows - 2))) * columns +
    (1 + Math.floor(random() * (columns - 2)));
  const start = pick();
  let goal = pick();
  while (goal === start) goal = pick();
  return { rows, columns, start, goal };
}

const SIZES: [number, number][] = [
  [20, 20],
  [21, 21],
  [26, 53],
  [30, 45],
  [45, 30],
  [5, 7],
  [7, 5],
  [6, 6],
];
const SEEDS = Array.from({ length: 15 }, (_, i) => i * 7919 + 1);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateMaze matches the old timer-driven implementation exactly', () => {
  for (const algorithm of ALGORITHM_IDS) {
    for (const [rows, columns] of SIZES) {
      it(`${algorithm} on ${rows}x${columns} (app and dragged placements, ${SEEDS.length} seeds each)`, () => {
        for (const seed of SEEDS) {
          for (const problem of [
            appPlacement(rows, columns, seed),
            interiorPlacement(rows, columns, seed),
          ]) {
            const expected = runOld(problem, algorithm, seed);
            expect(expected.size).toBeGreaterThan(0);
            const actual = toTickMap(
              generateMaze(problem, algorithm, seededRandom(seed))
            );
            expect(actual).toEqual(expected);
          }
        }
      });
    }
  }
});

// Start/goal strictly inside the border, start !== goal, plus a seed.
const mazeCaseArbitrary = fc
  .record({
    rows: fc.integer({ min: 5, max: 40 }),
    columns: fc.integer({ min: 5, max: 40 }),
  })
  .chain(({ rows, columns }) => {
    const interiorCell = fc
      .record({
        row: fc.integer({ min: 1, max: rows - 2 }),
        column: fc.integer({ min: 1, max: columns - 2 }),
      })
      .map(({ row, column }) => row * columns + column);
    return fc.record({
      problem: fc
        .record({ start: interiorCell, goal: interiorCell })
        .filter(({ start, goal }) => start !== goal)
        .map(({ start, goal }): MazeProblem => ({
          rows,
          columns,
          start,
          goal,
        })),
      seed: fc.integer(),
      algorithm: fc.constantFrom(...ALGORITHM_IDS),
    });
  });

function isConnected(
  problem: MazeProblem,
  placements: WallPlacement[]
): boolean {
  const { rows, columns } = problem;
  const blocked = new Uint8Array(rows * columns);
  for (const { index } of placements) blocked[index] = 1;
  const queue = [problem.start];
  blocked[problem.start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (index === problem.goal) return true;
    const row = Math.floor(index / columns);
    const column = index % columns;
    const next: number[] = [];
    if (row > 0) next.push(index - columns);
    if (column < columns - 1) next.push(index + 1);
    if (row < rows - 1) next.push(index + columns);
    if (column > 0) next.push(index - 1);
    for (const n of next) {
      if (!blocked[n]) {
        blocked[n] = 1;
        queue.push(n);
      }
    }
  }
  return false;
}

describe('generateMaze properties (random sizes, seeds and placements)', () => {
  it('never walls start/goal; placements are in bounds, unique, and sorted by non-negative integer tick', () => {
    fc.assert(
      fc.property(mazeCaseArbitrary, ({ problem, seed, algorithm }) => {
        const placements = generateMaze(problem, algorithm, seededRandom(seed));
        const size = problem.rows * problem.columns;
        const seen = new Set<number>();
        let previousTick = 0;
        for (const { index, tick } of placements) {
          expect(Number.isInteger(index) && index >= 0 && index < size).toBe(
            true
          );
          expect(seen.has(index)).toBe(false);
          seen.add(index);
          expect(Number.isInteger(tick) && tick >= 0).toBe(true);
          expect(tick).toBeGreaterThanOrEqual(previousTick);
          previousTick = tick;
        }
        expect(seen.has(problem.start)).toBe(false);
        expect(seen.has(problem.goal)).toBe(false);
      }),
      { numRuns: 300 }
    );
  });

  it('is deterministic for a given seed', () => {
    fc.assert(
      fc.property(mazeCaseArbitrary, ({ problem, seed, algorithm }) => {
        expect(generateMaze(problem, algorithm, seededRandom(seed))).toEqual(
          generateMaze(problem, algorithm, seededRandom(seed))
        );
      }),
      { numRuns: 200 }
    );
  });

  it('always leaves start and goal connected', () => {
    fc.assert(
      fc.property(mazeCaseArbitrary, ({ problem, seed, algorithm }) => {
        const placements = generateMaze(problem, algorithm, seededRandom(seed));
        expect(isConnected(problem, placements)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });
});
