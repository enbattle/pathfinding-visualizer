import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pathSegmentClasses } from './path-segments';
import { unweightedSearch } from '../algorithms/paths';
import { gridProblemArbitrary } from '../test-support/grid-problems';

describe('pathSegmentClasses', () => {
  it('draws straight runs and corners', () => {
    // 3 columns: 0 -> 1 -> 2 (right, right) then 2 -> 5 (down) -> 8 (down)
    expect(pathSegmentClasses([0, 1, 2, 5, 8], 3)).toEqual([
      'horizontal-path',
      'right-to-down-path',
      'vertical-path',
    ]);
  });

  it('has no segments for a path with no interior cells', () => {
    expect(pathSegmentClasses([0, 1], 3)).toEqual([]);
    expect(pathSegmentClasses([4], 3)).toEqual([]);
  });

  it('rejects a path with a non-neighbor step', () => {
    expect(() => pathSegmentClasses([0, 2, 3], 3)).toThrow();
  });

  // The previous implementation (showGoalPathLine in src/algorithms/
  // paths.tsx) produced these classes inline while animating; the extracted
  // version must pick the same class for every cell of every path.
  it('matches the previous implementation on random paths', () => {
    fc.assert(
      fc.property(gridProblemArbitrary({ weighted: false }), problem => {
        const { columns } = problem;
        const walls = new Set<string>();
        problem.walls.forEach((isWall, index) => {
          if (isWall)
            walls.add(`${Math.floor(index / columns)}_${index % columns}`);
        });
        const oldClasses = new Map<number, string>();
        const path = unweightedSearch(
          problem.rows,
          columns,
          {
            row: Math.floor(problem.start / columns),
            column: problem.start % columns,
            direction: '',
          },
          {
            row: Math.floor(problem.goal / columns),
            column: problem.goal % columns,
            direction: '',
          },
          walls,
          'BreadthFirstSearch',
          callback => callback(),
          {
            onCellVisited: () => {},
            onGoalPathFill: () => {},
            onPathDirection: (row, column, className) =>
              oldClasses.set(row * columns + column, className),
          }
        );
        if (!path) return;
        const indices = path.map(({ row, column }) => row * columns + column);
        const expected = indices
          .slice(1, -1)
          .map(index => oldClasses.get(index));
        expect(pathSegmentClasses(indices, columns)).toEqual(expected);
      }),
      { numRuns: 500 }
    );
  });
});
