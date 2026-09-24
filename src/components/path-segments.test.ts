import { describe, it, expect } from 'vitest';
import { pathSegmentClasses } from './path-segments';

// Class choices were proven identical to the pre-engine inline logic
// (showGoalPathLine in src/algorithms/paths.tsx, see git history) on 500
// random paths before that code was removed.
describe('pathSegmentClasses', () => {
  it('draws straight runs and corners', () => {
    // 3 columns: 0 -> 1 -> 2 (right, right) then 2 -> 5 (down) -> 8 (down)
    expect(pathSegmentClasses([0, 1, 2, 5, 8], 3)).toEqual([
      'horizontal-path',
      'right-to-down-path',
      'vertical-path',
    ]);
  });

  it('picks a corner for every turn', () => {
    // 3x3, cell 4 is the center; enter it from each side and turn.
    expect(pathSegmentClasses([7, 4, 3], 3)).toEqual(['right-to-down-path']); // up, then left
    expect(pathSegmentClasses([7, 4, 5], 3)).toEqual(['left-to-down-path']); // up, then right
    expect(pathSegmentClasses([1, 4, 3], 3)).toEqual(['right-to-up-path']); // down, then left
    expect(pathSegmentClasses([1, 4, 5], 3)).toEqual(['left-to-up-path']); // down, then right
    expect(pathSegmentClasses([5, 4, 1], 3)).toEqual(['left-to-up-path']); // left, then up
    expect(pathSegmentClasses([5, 4, 7], 3)).toEqual(['left-to-down-path']); // left, then down
    expect(pathSegmentClasses([3, 4, 1], 3)).toEqual(['right-to-up-path']); // right, then up
    expect(pathSegmentClasses([3, 4, 7], 3)).toEqual(['right-to-down-path']); // right, then down
  });

  it('has no segments for a path with no interior cells', () => {
    expect(pathSegmentClasses([0, 1], 3)).toEqual([]);
    expect(pathSegmentClasses([4], 3)).toEqual([]);
  });

  it('rejects a path with a non-neighbor step', () => {
    expect(() => pathSegmentClasses([0, 2, 3], 3)).toThrow();
  });
});
