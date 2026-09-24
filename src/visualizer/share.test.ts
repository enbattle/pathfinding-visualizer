import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PATH_ALGORITHMS, type PathAlgorithmId } from '../engine';
import {
  decodeShare,
  encodeShare,
  MAX_FRAGMENT_LENGTH,
  type SharedBoard,
  type SharedState,
} from './share';

const IDS = PATH_ALGORITHMS.map(({ id }) => id);

function board(
  rows: number,
  columns: number,
  overrides: Partial<SharedBoard> = {}
): SharedBoard {
  return {
    rows,
    columns,
    start: 0,
    goal: rows * columns - 1,
    walls: new Uint8Array(rows * columns),
    weights: new Uint8Array(rows * columns).fill(1),
    ...overrides,
  };
}

const explore = (
  b: SharedBoard,
  a: PathAlgorithmId = 'astar'
): SharedState => ({
  board: b,
  mode: 'explore',
  algorithms: [a],
});

// Builds a fragment from raw bytes, bypassing encodeShare's validation.
function rawFragment(bytes: number[], extra = 'm=explore&a=bfs'): string {
  const binary = String.fromCharCode(...bytes);
  const b = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `v=1&b=${b}&${extra}`;
}

// Header + bitsets for a rows x columns board, start 0, goal last.
function rawBoardBytes(rows: number, columns: number): number[] {
  const size = rows * columns;
  const goal = size - 1;
  const bitset = Math.ceil(size / 8);
  return [
    1,
    rows >> 8,
    rows & 0xff,
    columns >> 8,
    columns & 0xff,
    0,
    0,
    0,
    0,
    (goal >>> 24) & 0xff,
    (goal >>> 16) & 0xff,
    (goal >>> 8) & 0xff,
    goal & 0xff,
    ...new Array<number>(2 * bitset).fill(0),
  ];
}

// Arbitrary valid state: sizes 2..40, random walls/weights, never on
// start/goal, never both on one cell.
const stateArbitrary: fc.Arbitrary<SharedState> = fc
  .record({
    rows: fc.integer({ min: 2, max: 40 }),
    columns: fc.integer({ min: 2, max: 40 }),
  })
  .chain(({ rows, columns }) => {
    const size = rows * columns;
    return fc.record({
      rows: fc.constant(rows),
      columns: fc.constant(columns),
      start: fc.integer({ min: 0, max: size - 1 }),
      goal: fc.integer({ min: 0, max: size - 1 }),
      cells: fc.array(fc.integer({ min: 0, max: 5 }), {
        minLength: size,
        maxLength: size,
      }),
      mode: fc.constantFrom('explore' as const, 'race' as const),
      algorithms: fc.shuffledSubarray(IDS, { minLength: 2, maxLength: 4 }),
    });
  })
  .filter(({ start, goal }) => start !== goal)
  .map(({ rows, columns, start, goal, cells, mode, algorithms }) => {
    const walls = new Uint8Array(rows * columns);
    const weights = new Uint8Array(rows * columns).fill(1);
    cells.forEach((roll, i) => {
      if (i === start || i === goal) return;
      if (roll === 0) walls[i] = 1;
      else if (roll === 1) weights[i] = 5;
    });
    return {
      board: { rows, columns, start, goal, walls, weights },
      mode,
      algorithms: mode === 'explore' ? algorithms.slice(0, 1) : algorithms,
    };
  });

function normalize(state: SharedState) {
  return {
    ...state,
    board: {
      ...state.board,
      walls: [...state.board.walls],
      weights: [...state.board.weights],
    },
  };
}

// Re-checks every rule on a decoded state, independently of share.ts.
function assertValid(state: SharedState): void {
  const { rows, columns, start, goal, walls, weights } = state.board;
  const size = rows * columns;
  expect(rows >= 2 && rows <= 200 && columns >= 2 && columns <= 200).toBe(true);
  expect(size).toBeLessThanOrEqual(20_000);
  expect(walls.length).toBe(size);
  expect(weights.length).toBe(size);
  expect(start).not.toBe(goal);
  expect(start >= 0 && start < size && goal >= 0 && goal < size).toBe(true);
  for (const anchor of [start, goal]) {
    expect(walls[anchor]).toBe(0);
    expect(weights[anchor]).toBe(1);
  }
  for (let i = 0; i < size; i++) {
    expect(walls[i] === 1 && weights[i] > 1).toBe(false);
  }
  expect(new Set(state.algorithms).size).toBe(state.algorithms.length);
  for (const id of state.algorithms) expect(IDS).toContain(id);
  if (state.mode === 'explore') expect(state.algorithms).toHaveLength(1);
  else
    expect(state.algorithms.length >= 2 && state.algorithms.length <= 4).toBe(
      true
    );
}

describe('share codec', () => {
  it('round-trips any valid state', () => {
    fc.assert(
      fc.property(stateArbitrary, state => {
        const decoded = decodeShare(encodeShare(state));
        expect(decoded.ok).toBe(true);
        if (decoded.ok)
          expect(normalize(decoded.state)).toEqual(normalize(state));
      }),
      { numRuns: 300 }
    );
  });

  it('never throws on arbitrary strings', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.string({ unit: 'binary' }),
          fc.string({ unit: 'grapheme' })
        ),
        text => {
          const result = decodeShare(text);
          if (result.ok) assertValid(result.state);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('never throws on mutated valid fragments, and anything accepted is valid', () => {
    const mutation = fc.oneof(
      fc.record({
        kind: fc.constant('flip' as const),
        at: fc.nat(),
        char: fc.string({ minLength: 1, maxLength: 1 }),
      }),
      fc.record({
        kind: fc.constant('insert' as const),
        at: fc.nat(),
        char: fc.string({ minLength: 1, maxLength: 3 }),
      }),
      fc.record({ kind: fc.constant('delete' as const), at: fc.nat() }),
      fc.record({ kind: fc.constant('truncate' as const), at: fc.nat() }),
      fc.record({
        kind: fc.constant('param' as const),
        key: fc.constantFrom('v', 'm', 'a'),
        value: fc.string(),
      })
    );
    fc.assert(
      fc.property(
        stateArbitrary,
        fc.array(mutation, { minLength: 1, maxLength: 4 }),
        (state, mutations) => {
          const params = new URLSearchParams(encodeShare(state));
          for (const m of mutations) {
            let b = params.get('b') ?? '';
            const at =
              b.length === 0
                ? 0
                : m.kind === 'param'
                  ? 0
                  : m.at % (b.length + 1);
            if (m.kind === 'flip')
              b = b.slice(0, at) + m.char + b.slice(at + 1);
            else if (m.kind === 'insert')
              b = b.slice(0, at) + m.char + b.slice(at);
            else if (m.kind === 'delete') b = b.slice(0, at) + b.slice(at + 1);
            else if (m.kind === 'truncate') b = b.slice(0, at);
            else params.set(m.key, m.value);
            params.set('b', b);
          }
          const result = decodeShare(params.toString());
          if (result.ok) assertValid(result.state);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('accepts a leading # and ignores unknown params', () => {
    const fragment = encodeShare(explore(board(3, 4)));
    expect(decodeShare(`#${fragment}`).ok).toBe(true);
    expect(decodeShare(`${fragment}&utm_source=x&zz=1`).ok).toBe(true);
  });

  it('defaults to explore with bfs when mode and algorithms are absent', () => {
    const fragment = new URLSearchParams(encodeShare(explore(board(3, 4))));
    fragment.delete('m');
    fragment.delete('a');
    const result = decodeShare(fragment.toString());
    expect(result.ok && result.state).toMatchObject({
      mode: 'explore',
      algorithms: ['bfs'],
    });
  });

  it('encodes a 26x53 board in under 600 characters', () => {
    const b = board(26, 53);
    for (let i = 60; i < b.walls.length - 60; i += 3) b.walls[i] = 1;
    for (let i = 61; i < b.walls.length - 60; i += 7)
      if (!b.walls[i]) b.weights[i] = 5;
    const fragment = encodeShare({
      board: b,
      mode: 'race',
      algorithms: ['bfs', 'dijkstra', 'astar', 'greedy'],
    });
    expect(fragment.length).toBeLessThan(600);
  });

  it('encodeShare throws RangeError on an invalid state', () => {
    expect(() => encodeShare(explore(board(3, 4, { goal: 0 })))).toThrow(
      RangeError
    );
    expect(() =>
      encodeShare({ board: board(3, 4), mode: 'race', algorithms: ['bfs'] })
    ).toThrow(RangeError);
    expect(() => encodeShare(explore(board(1, 4)))).toThrow(RangeError);
  });
});

describe('share codec rejects', () => {
  const valid = () => new URLSearchParams(encodeShare(explore(board(3, 4))));
  const withParam = (key: string, value: string) => {
    const params = valid();
    params.set(key, value);
    return params.toString();
  };
  const expectError = (fragment: string, pattern: RegExp) => {
    const result = decodeShare(fragment);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(pattern);
  };

  it('a wrong version (param or byte)', () => {
    expectError(withParam('v', '2'), /version/);
    const bytes = rawBoardBytes(3, 4);
    bytes[0] = 2;
    expectError(rawFragment(bytes), /version/);
  });

  it('an oversized fragment', () => {
    expectError(`v=1&b=${'A'.repeat(MAX_FRAGMENT_LENGTH)}`, /too long/);
  });

  it('bad base64url', () => {
    expectError(withParam('b', 'AB+/'), /base64/);
    expectError(withParam('b', 'A'), /base64/);
  });

  it('truncated or extra bytes', () => {
    expectError(rawFragment(rawBoardBytes(3, 4).slice(0, -1)), /size/);
    expectError(rawFragment([...rawBoardBytes(3, 4), 0]), /size/);
    expectError(rawFragment([1, 0, 3]), /truncated/);
  });

  it('nonzero padding bits in a bitset', () => {
    // 3x3 = 9 cells: the second bitset byte uses only bit 0.
    const bytes = rawBoardBytes(3, 3);
    bytes[13 + 1] = 0b10;
    expectError(rawFragment(bytes), /stray bits/);
  });

  it('dimensions out of range', () => {
    expectError(rawFragment(rawBoardBytes(1, 4)), /size/);
    expectError(rawFragment(rawBoardBytes(201, 2)), /size/);
  });

  it('too many cells', () => {
    expectError(rawFragment(rawBoardBytes(150, 150)), /at most/);
  });

  it('start === goal', () => {
    const bytes = rawBoardBytes(3, 4);
    bytes.splice(9, 4, 0, 0, 0, 0);
    expectError(rawFragment(bytes), /differ/);
  });

  it('start on a wall', () => {
    const bytes = rawBoardBytes(3, 4);
    bytes[13] = 1; // wall on cell 0 = start
    expectError(rawFragment(bytes), /open/);
  });

  it('a cell that is both wall and weighted', () => {
    const bytes = rawBoardBytes(3, 4);
    bytes[13] = 0b10; // wall on cell 1
    bytes[15] = 0b10; // weight on cell 1 (3x4 = 12 cells -> 2-byte bitsets)
    expectError(rawFragment(bytes), /both/);
  });

  it('an unknown algorithm', () => {
    expectError(withParam('a', 'bogo'), /Unknown algorithm/);
  });

  it('a duplicate algorithm', () => {
    const params = valid();
    params.set('m', 'race');
    params.set('a', 'bfs,bfs');
    expectError(params.toString(), /only once/);
  });

  it('explore with 2 algorithms', () => {
    expectError(withParam('a', 'bfs,astar'), /exactly one/);
  });

  it('race with 1 or 5 algorithms', () => {
    const race = (a: string) => {
      const params = valid();
      params.set('m', 'race');
      params.set('a', a);
      return params.toString();
    };
    expectError(race('bfs'), /2 to 4/);
    expectError(race('bfs,dfs,greedy,dijkstra,astar'), /2 to 4/);
  });

  it('race with no algorithms', () => {
    const params = valid();
    params.set('m', 'race');
    params.delete('a');
    expectError(params.toString(), /needs its algorithms/);
  });

  it('an unknown mode', () => {
    expectError(withParam('m', 'chaos'), /mode/);
  });
});
