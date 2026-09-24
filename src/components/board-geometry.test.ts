import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { cellsBetween } from './board-geometry';

const COLUMNS = 10;
const at = (row: number, column: number) => row * COLUMNS + column;

describe('cellsBetween', () => {
  it('walks a straight row or column', () => {
    expect(cellsBetween(at(2, 1), at(2, 4), COLUMNS)).toEqual([
      at(2, 2),
      at(2, 3),
      at(2, 4),
    ]);
    expect(cellsBetween(at(5, 3), at(2, 3), COLUMNS)).toEqual([
      at(4, 3),
      at(3, 3),
      at(2, 3),
    ]);
  });

  it('is empty for the same cell and just `to` for a neighbor', () => {
    expect(cellsBetween(at(1, 1), at(1, 1), COLUMNS)).toEqual([]);
    expect(cellsBetween(at(1, 1), at(1, 2), COLUMNS)).toEqual([at(1, 2)]);
  });

  // For any two cells: ends at `to`, every step moves to an edge-adjacent
  // cell, and the walk is as short as possible (a Manhattan path).
  it('always makes an unbroken, shortest edge-adjacent path', () => {
    const cell = fc.integer({ min: 0, max: 10 * COLUMNS - 1 });
    fc.assert(
      fc.property(cell, cell, (from, to) => {
        const path = cellsBetween(from, to, COLUMNS);
        const rowOf = (i: number) => Math.floor(i / COLUMNS);
        const columnOf = (i: number) => i % COLUMNS;
        const manhattan =
          Math.abs(rowOf(from) - rowOf(to)) +
          Math.abs(columnOf(from) - columnOf(to));
        expect(path.length).toBe(manhattan);
        if (path.length) expect(path.at(-1)).toBe(to);
        let previous = from;
        for (const next of path) {
          const step =
            Math.abs(rowOf(next) - rowOf(previous)) +
            Math.abs(columnOf(next) - columnOf(previous));
          expect(step).toBe(1);
          previous = next;
        }
      })
    );
  });
});
