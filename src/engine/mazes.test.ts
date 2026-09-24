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
// was removed - see the git history of src/algorithms/walls.tsx.) Only
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
