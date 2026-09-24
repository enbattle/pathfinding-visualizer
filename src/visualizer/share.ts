import {
  PATH_ALGORITHMS,
  WEIGHTED_TERRAIN_COST,
  type PathAlgorithmId,
} from '../engine';

// Share-by-URL: a board plus the algorithm choice, packed into a URL
// fragment. The fragment is untrusted input (anyone can hand you a link),
// so decodeShare() validates everything, bounds the work it does before
// validating, and never throws.

const SHARE_VERSION = 1;
const MAX_SHARED_CELLS = 20_000;
// Smaller boards have no interior for a maze, and on 3-4 rows the app's
// random start/goal placement (board-setup.ts) could pick the same cell.
const MIN_SHARED_DIMENSION = 5;
const MAX_SHARED_DIMENSION = 200;
/** Longer input is rejected before any decoding. */
export const MAX_FRAGMENT_LENGTH = 12_000;

export interface SharedBoard {
  readonly rows: number;
  readonly columns: number;
  /** Flat index, row * columns + column. */
  readonly start: number;
  readonly goal: number;
  /** One entry per cell: 0 or 1. */
  readonly walls: Uint8Array;
  /** One entry per cell: 1 = normal, >1 = weighted. */
  readonly weights: Uint8Array;
}

export type ShareMode = 'explore' | 'race';

export interface SharedState {
  readonly board: SharedBoard;
  readonly mode: ShareMode;
  /** explore: exactly 1; race: 2 to 4, all different. */
  readonly algorithms: readonly PathAlgorithmId[];
}

export type DecodeResult =
  | { readonly ok: true; readonly state: SharedState }
  | { readonly ok: false; readonly error: string };

const KNOWN_ALGORITHMS = new Set<string>(PATH_ALGORITHMS.map(({ id }) => id));
const HEADER_BYTES = 13; // version u8, rows u16, columns u16, start u32, goal u32

// --- base64url (RFC 4648 §5, no padding) ------------------------------------

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const ALPHABET_INDEX = new Map([...ALPHABET].map((char, i) => [char, i]));

function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += ALPHABET[(triple >> 18) & 63] + ALPHABET[(triple >> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHABET[(triple >> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHABET[triple & 63];
  }
  return out;
}

/** Returns null for any non-canonical base64url input. */
function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
  let bits = 0;
  let bitCount = 0;
  let offset = 0;
  for (const char of text) {
    const value = ALPHABET_INDEX.get(char);
    if (value === undefined) return null;
    bits = (bits << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[offset++] = (bits >> bitCount) & 0xff;
      bits &= (1 << bitCount) - 1;
    }
  }
  // Leftover bits must be zero, so each byte string has one encoding.
  if (bits !== 0) return null;
  return bytes;
}

// --- validation (shared by encode and decode) --------------------------------

function validateDimensions(rows: number, columns: number): string | null {
  const inRange = (n: number) =>
    Number.isInteger(n) &&
    n >= MIN_SHARED_DIMENSION &&
    n <= MAX_SHARED_DIMENSION;
  if (!inRange(rows) || !inRange(columns)) {
    return `Board size must be ${MIN_SHARED_DIMENSION} to ${MAX_SHARED_DIMENSION} cells per side`;
  }
  if (rows * columns > MAX_SHARED_CELLS) {
    return `Board must have at most ${MAX_SHARED_CELLS} cells`;
  }
  return null;
}

function validateBoard(board: SharedBoard): string | null {
  const dimensionError = validateDimensions(board.rows, board.columns);
  if (dimensionError) return dimensionError;
  const size = board.rows * board.columns;
  if (board.walls.length !== size || board.weights.length !== size) {
    return 'Board data does not match its size';
  }
  const isCell = (i: number) => Number.isInteger(i) && i >= 0 && i < size;
  if (!isCell(board.start) || !isCell(board.goal)) {
    return 'Start and goal must be on the board';
  }
  if (board.start === board.goal) return 'Start and goal must differ';
  for (const anchor of [board.start, board.goal]) {
    if (board.walls[anchor] !== 0 || board.weights[anchor] !== 1) {
      return 'Start and goal must be open, unweighted cells';
    }
  }
  for (let i = 0; i < size; i++) {
    if (board.walls[i] !== 0 && board.walls[i] !== 1) {
      return 'Walls must be 0 or 1';
    }
    if (board.weights[i] < 1) return 'Weights must be at least 1';
    if (board.walls[i] === 1 && board.weights[i] > 1) {
      return 'A cell cannot be both a wall and weighted';
    }
  }
  return null;
}

function validateAlgorithms(
  mode: string,
  algorithms: readonly string[]
): string | null {
  if (mode !== 'explore' && mode !== 'race') return 'Unknown mode';
  for (const id of algorithms) {
    if (!KNOWN_ALGORITHMS.has(id)) return 'Unknown algorithm';
  }
  if (new Set(algorithms).size !== algorithms.length) {
    return 'Each algorithm may appear only once';
  }
  if (mode === 'explore' && algorithms.length !== 1) {
    return 'Explore mode takes exactly one algorithm';
  }
  if (mode === 'race' && (algorithms.length < 2 || algorithms.length > 4)) {
    return 'Race mode takes 2 to 4 algorithms';
  }
  return null;
}

// --- encode / decode ---------------------------------------------------------

/**
 * Packs `state` into a URL fragment (no leading '#'), e.g.
 * "v=1&b=<base64url>&m=race&a=bfs,astar". Throws RangeError if `state`
 * breaks any rule decodeShare() enforces.
 */
export function encodeShare(state: SharedState): string {
  const error =
    validateBoard(state.board) ??
    validateAlgorithms(state.mode, state.algorithms);
  if (error) throw new RangeError(error);

  const { rows, columns, start, goal, walls, weights } = state.board;
  const size = rows * columns;
  const bitsetBytes = Math.ceil(size / 8);
  const bytes = new Uint8Array(HEADER_BYTES + 2 * bitsetBytes);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, SHARE_VERSION);
  view.setUint16(1, rows);
  view.setUint16(3, columns);
  view.setUint32(5, start);
  view.setUint32(9, goal);
  const wallsOffset = HEADER_BYTES;
  const weightsOffset = HEADER_BYTES + bitsetBytes;
  for (let i = 0; i < size; i++) {
    const bit = 1 << (i % 8);
    if (walls[i]) bytes[wallsOffset + (i >> 3)] |= bit;
    if (weights[i] > 1) bytes[weightsOffset + (i >> 3)] |= bit;
  }

  const params = new URLSearchParams({
    v: String(SHARE_VERSION),
    b: toBase64Url(bytes),
    m: state.mode,
    a: state.algorithms.join(','),
  });
  // Keep ',' readable in the address bar; it's safe in a fragment.
  return params.toString().replace(/%2C/g, ',');
}

/**
 * Unpacks a URL fragment (with or without a leading '#'). Never throws:
 * any malformed or out-of-bounds input gives `{ ok: false, error }`.
 */
export function decodeShare(fragment: string): DecodeResult {
  try {
    return decodeUnsafe(fragment);
  } catch {
    return { ok: false, error: 'Invalid share link' };
  }
}

function decodeUnsafe(fragment: string): DecodeResult {
  const fail = (error: string): DecodeResult => ({ ok: false, error });
  if (typeof fragment !== 'string') return fail('Invalid share link');
  if (fragment.length > MAX_FRAGMENT_LENGTH)
    return fail('Share link is too long');

  const params = new URLSearchParams(
    fragment.startsWith('#') ? fragment.slice(1) : fragment
  );
  if (params.get('v') !== String(SHARE_VERSION)) {
    return fail('Unsupported share version');
  }
  const encoded = params.get('b');
  if (!encoded) return fail('Share link has no board');
  const bytes = fromBase64Url(encoded);
  if (!bytes) return fail('Board data is not valid base64url');
  if (bytes.length < HEADER_BYTES) return fail('Board data is truncated');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint8(0) !== SHARE_VERSION) {
    return fail('Unsupported share version');
  }
  const rows = view.getUint16(1);
  const columns = view.getUint16(3);
  const dimensionError = validateDimensions(rows, columns);
  if (dimensionError) return fail(dimensionError);

  const size = rows * columns;
  const bitsetBytes = Math.ceil(size / 8);
  if (bytes.length !== HEADER_BYTES + 2 * bitsetBytes) {
    return fail('Board data does not match its size');
  }
  // The last byte of each bitset may only use the bits for real cells.
  const unusedBits = bitsetBytes * 8 - size;
  if (unusedBits > 0) {
    const mask = 0xff << (8 - unusedBits);
    for (const offset of [HEADER_BYTES, HEADER_BYTES + bitsetBytes]) {
      if (bytes[offset + bitsetBytes - 1] & mask) {
        return fail('Board data has stray bits');
      }
    }
  }

  const walls = new Uint8Array(size);
  const weights = new Uint8Array(size).fill(1);
  for (let i = 0; i < size; i++) {
    const bit = 1 << (i % 8);
    if (bytes[HEADER_BYTES + (i >> 3)] & bit) walls[i] = 1;
    if (bytes[HEADER_BYTES + bitsetBytes + (i >> 3)] & bit) {
      weights[i] = WEIGHTED_TERRAIN_COST;
    }
  }
  const board: SharedBoard = {
    rows,
    columns,
    start: view.getUint32(5),
    goal: view.getUint32(9),
    walls,
    weights,
  };
  const boardError = validateBoard(board);
  if (boardError) return fail(boardError);

  const mode = params.get('m') ?? 'explore';
  const list = params.get('a');
  let algorithms: string[];
  if (list === null) {
    if (mode === 'race') return fail('Race mode needs its algorithms');
    algorithms = ['bfs'];
  } else {
    algorithms = list.split(',');
  }
  const algorithmError = validateAlgorithms(mode, algorithms);
  if (algorithmError) return fail(algorithmError);

  return {
    ok: true,
    state: {
      board,
      mode: mode as ShareMode,
      algorithms: algorithms as PathAlgorithmId[],
    },
  };
}
