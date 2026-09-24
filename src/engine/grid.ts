// A rectangular, 4-connected grid stored flat (row-major) in typed arrays:
// cell `index = row * columns + column`. Typed arrays keep a whole board in
// a few contiguous kilobytes and make per-cell lookups plain array reads -
// no string keys, no Set/Map hashing in the search loop.
export interface Grid {
  readonly rows: number;
  readonly columns: number;
  /** 1 = wall, 0 = open. */
  readonly walls: Uint8Array;
  /** Cost of entering each cell; 1 = normal terrain, higher = weighted. */
  readonly weights: Uint8Array;
}

/**
 * Entry cost of a weighted-terrain cell (normal cells cost 1). The one
 * definition: the UI paints it, share links store "weighted" as one bit and
 * decode back to it, and the legend and help text quote it.
 */
export const WEIGHTED_TERRAIN_COST = 5;

export function createGrid(rows: number, columns: number): Grid {
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(columns) ||
    rows < 1 ||
    columns < 1
  ) {
    throw new RangeError(`Invalid grid size ${rows}x${columns}`);
  }
  const size = rows * columns;
  return {
    rows,
    columns,
    walls: new Uint8Array(size),
    weights: new Uint8Array(size).fill(1),
  };
}

export function toIndex(
  grid: Pick<Grid, 'columns'>,
  row: number,
  column: number
): number {
  return row * grid.columns + column;
}

/**
 * Writes the in-bounds 4-neighbors of `index` into `out` and returns how
 * many there are. Order is always up, right, down, left - exploration
 * order (and so which of several equally good paths gets found) depends on
 * it, so keep it stable. Writing into a caller-owned buffer instead of
 * returning an array keeps the search loop allocation-free.
 */
export function neighbors(
  grid: Pick<Grid, 'rows' | 'columns'>,
  index: number,
  out: Int32Array
): number {
  const { rows, columns } = grid;
  const row = Math.floor(index / columns);
  const column = index - row * columns;
  let count = 0;
  if (row > 0) out[count++] = index - columns;
  if (column < columns - 1) out[count++] = index + 1;
  if (row < rows - 1) out[count++] = index + columns;
  if (column > 0) out[count++] = index - 1;
  return count;
}
