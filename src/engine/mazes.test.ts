import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  generateMaze,
  MAZE_ALGORITHMS,
  type MazeProblem,
  type WallPlacement,
} from './mazes';
import { seededRandom } from './random';

const ALGORITHM_IDS = MAZE_ALGORITHMS.map(({ id }) => id);

// '#' wall, 'S' start, 'G' goal, '.' open.
function render(problem: MazeProblem, placements: WallPlacement[]): string {
  const walls = new Set(placements.map(({ index }) => index));
  const lines: string[] = [];
  for (let row = 0; row < problem.rows; row++) {
    let line = '';
    for (let column = 0; column < problem.columns; column++) {
      const index = row * problem.columns + column;
      if (index === problem.start) line += 'S';
      else if (index === problem.goal) line += 'G';
      else line += walls.has(index) ? '#' : '.';
    }
    lines.push(line);
  }
  return `\n${lines.join('\n')}\n`;
}

// Locks in each algorithm's exact output for a fixed seed, so any change to
// how mazes are generated shows up as a readable diff in review. (Output
// was proven identical to the pre-engine implementation before that code
// was removed: commit "Remove the pre-engine algorithms and document the
// architecture" deleted src/algorithms/walls.tsx.) Only
// regenerate (vitest -u) for an intentional change.
describe('generateMaze snapshots (seed 42, 13x25, app-style start/goal)', () => {
  const problem: MazeProblem = {
    rows: 13,
    columns: 25,
    start: 11 * 25 + 4,
    goal: 1 * 25 + 19,
  };

  it.each(ALGORITHM_IDS)('%s', algorithm => {
    expect(
      render(problem, generateMaze(problem, algorithm, seededRandom(42)))
    ).toMatchSnapshot();
  });

  it('animates the border and the interior in parallel from tick 0', () => {
    const atTickZero = generateMaze(
      problem,
      'recursive-division',
      seededRandom(42)
    )
      .filter(({ tick }) => tick === 0)
      .map(({ index }) => index);
    const isBorder = (index: number) =>
      index < 25 || index % 25 === 0 || index % 25 === 24 || index >= 12 * 25;
    expect(atTickZero.some(isBorder)).toBe(true);
    expect(atTickZero.some(index => !isBorder(index))).toBe(true);
  });
});

// Start/goal anywhere on the board - interior, edges or corners (a marker
// can be dragged or shared onto any cell) - start !== goal, plus a seed.
const mazeCaseArbitrary = fc
  .record({
    rows: fc.integer({ min: 5, max: 40 }),
    columns: fc.integer({ min: 5, max: 40 }),
  })
  .chain(({ rows, columns }) => {
    const anyCell = fc.integer({ min: 0, max: rows * columns - 1 });
    // Bias toward the border and corners, where mazes are hardest to keep
    // connected, so they come up in most runs rather than rarely.
    const borderCell = fc
      .record({
        side: fc.constantFrom('top', 'bottom', 'left', 'right'),
        offset: fc.nat(),
      })
      .map(({ side, offset }) => {
        if (side === 'top') return offset % columns;
        if (side === 'bottom') return (rows - 1) * columns + (offset % columns);
        if (side === 'left') return (offset % rows) * columns;
        return (offset % rows) * columns + columns - 1;
      });
    const interiorCell = fc.oneof(anyCell, borderCell);
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

  // Also the regression test for start/goal dragged onto a row/column a
  // dividing wall runs straight through (see isEmbeddedInWall in mazes.ts):
  // start/goal can be anywhere in the interior here, not just where the
  // app first places them.
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

// Regression test for start/goal on the border: an independent audit found
// that a marker dragged or shared onto an edge or corner could be sealed
// off (corners every time; Prim's often on edges). Checks every border
// cell of the app's typical board size, for every algorithm.
describe('generateMaze with start or goal on the border', () => {
  const rows = 26;
  const columns = 53;
  const border: number[] = [];
  for (let index = 0; index < rows * columns; index++) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    if (
      row === 0 ||
      row === rows - 1 ||
      column === 0 ||
      column === columns - 1
    ) {
      border.push(index);
    }
  }

  it.each(ALGORITHM_IDS)(
    '%s keeps every border start connected to the goal',
    algorithm => {
      const interiorGoal = 12 * columns + 26;
      const oppositeCorner = rows * columns - 1;
      for (const start of border) {
        for (const goal of [interiorGoal, oppositeCorner]) {
          if (start === goal) continue;
          const problem: MazeProblem = { rows, columns, start, goal };
          const placements = generateMaze(
            problem,
            algorithm,
            seededRandom(start)
          );
          expect(
            isConnected(problem, placements),
            `start ${start}, goal ${goal}`
          ).toBe(true);
        }
      }
    }
  );
});
