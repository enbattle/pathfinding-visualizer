// Randomness is always injected (never a bare Math.random call inside an
// algorithm) so a maze can be reproduced exactly from a seed - in tests,
// and later for shareable board URLs.

/** Returns a float in [0, 1), like Math.random. */
export type Random = () => number;

/**
 * mulberry32: a tiny, fast, well-distributed 32-bit seeded PRNG. Not
 * cryptographic - it only needs to make mazes reproducible.
 */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [min, max], both inclusive. */
export function randomInt(random: Random, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1) + min);
}

/**
 * Uniform even integer in [min, max]. Returns -1 when there is none
 * (min === max and odd).
 */
export function randomEvenInt(
  random: Random,
  min: number,
  max: number
): number {
  if (min === max) return min % 2 === 0 ? min : -1;
  const low = min % 2 !== 0 ? min + 1 : min;
  return low + 2 * randomInt(random, 0, Math.floor((max - low) / 2));
}

/**
 * Uniform odd integer in [min, max]. Returns -1 when there is none
 * (min === max and even).
 */
export function randomOddInt(random: Random, min: number, max: number): number {
  if (min === max) return min % 2 !== 0 ? min : -1;
  const low = min % 2 === 0 ? min + 1 : min;
  return low + 2 * randomInt(random, 0, Math.floor((max - low) / 2));
}
