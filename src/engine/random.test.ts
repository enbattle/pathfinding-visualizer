import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { randomEvenInt, randomInt, randomOddInt, seededRandom } from './random';

describe('seededRandom', () => {
  it('returns floats in [0, 1)', () => {
    fc.assert(
      fc.property(fc.integer(), seed => {
        const random = seededRandom(seed);
        for (let i = 0; i < 100; i++) {
          const value = random();
          expect(value >= 0 && value < 1).toBe(true);
        }
      })
    );
  });

  it('repeats exactly for the same seed', () => {
    fc.assert(
      fc.property(fc.integer(), seed => {
        const a = seededRandom(seed);
        const b = seededRandom(seed);
        for (let i = 0; i < 50; i++) expect(a()).toBe(b());
      })
    );
  });

  it('differs across seeds', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

const range = fc
  .tuple(fc.integer({ min: -50, max: 50 }), fc.integer({ min: 0, max: 50 }))
  .map(([min, span]) => ({ min, max: min + span }));

describe('randomInt / randomEvenInt / randomOddInt', () => {
  it('randomInt stays within [min, max]', () => {
    fc.assert(
      fc.property(range, fc.integer(), ({ min, max }, seed) => {
        const value = randomInt(seededRandom(seed), min, max);
        expect(Number.isInteger(value) && value >= min && value <= max).toBe(
          true
        );
      })
    );
  });

  it.each([
    ['randomEvenInt', randomEvenInt, 0],
    ['randomOddInt', randomOddInt, 1],
  ] as const)(
    '%s returns a value of the right parity in range, or -1 when none exists',
    (_name, pick, parity) => {
      fc.assert(
        fc.property(range, fc.integer(), ({ min, max }, seed) => {
          const value = pick(seededRandom(seed), min, max);
          const exists = min !== max || Math.abs(min % 2) === parity;
          if (exists) {
            expect(value >= min && value <= max).toBe(true);
            expect(Math.abs(value % 2)).toBe(parity);
          } else {
            expect(value).toBe(-1);
          }
        })
      );
    }
  );
});
