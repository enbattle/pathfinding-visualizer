import { describe, it, expect } from 'vitest';
import {
  randIntBetween,
  evenRandIntBetween,
  oddRandIntBetween,
  getEuclideanDistance,
} from './function-util';

describe('randIntBetween', () => {
  it('stays within [min, max] inclusive across many trials', () => {
    for (let i = 0; i < 200; i++) {
      const value = randIntBetween(5, 10);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThanOrEqual(10);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('returns the single value when min equals max', () => {
    for (let i = 0; i < 20; i++) {
      expect(randIntBetween(7, 7)).toBe(7);
    }
  });
});

describe('evenRandIntBetween', () => {
  it('always returns an even number within range across many trials', () => {
    for (let i = 0; i < 200; i++) {
      const value = evenRandIntBetween(1, 11);
      expect(value % 2).toBe(0);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(11);
    }
  });

  it('returns min when min equals max and both are even', () => {
    expect(evenRandIntBetween(8, 8)).toBe(8);
  });

  it('returns -1 when min equals max and both are odd', () => {
    expect(evenRandIntBetween(9, 9)).toBe(-1);
  });
});

describe('oddRandIntBetween', () => {
  it('always returns an odd number within range across many trials', () => {
    for (let i = 0; i < 200; i++) {
      const value = oddRandIntBetween(2, 12);
      expect(value % 2).not.toBe(0);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(12);
    }
  });

  it('returns min when min equals max and both are odd', () => {
    expect(oddRandIntBetween(7, 7)).toBe(7);
  });

  it('returns -1 when min equals max and both are even', () => {
    expect(oddRandIntBetween(4, 4)).toBe(-1);
  });
});

describe('getEuclideanDistance', () => {
  function coord(row: number, column: number) {
    return { row, column, direction: '' };
  }

  it('returns true distance, not squared - regression lock for the A* admissibility fix', () => {
    // A classic 3-4-5 right triangle offset: true distance is exactly 5.
    // Squared distance (the bug this locks against) would give 25, which
    // overestimates and breaks A*'s shortest-path guarantee.
    expect(getEuclideanDistance(coord(0, 0), coord(3, 4))).toBe(5);
  });

  it('is zero for identical coordinates', () => {
    expect(getEuclideanDistance(coord(5, 5), coord(5, 5))).toBe(0);
  });

  it('is symmetric', () => {
    const a = coord(1, 2);
    const b = coord(8, 10);
    expect(getEuclideanDistance(a, b)).toBe(getEuclideanDistance(b, a));
  });

  it('matches true Euclidean distance for a non-integer-hypotenuse offset', () => {
    // (row diff 1, column diff 1) -> sqrt(2), not 2.
    expect(getEuclideanDistance(coord(0, 0), coord(1, 1))).toBeCloseTo(
      Math.SQRT2,
      10
    );
  });
});
