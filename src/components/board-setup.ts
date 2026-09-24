import { randomInt } from '../engine';

export interface Coordinate {
  row: number;
  column: number;
}

// Target cell size when choosing how many rows/columns a new board gets
// from the space available. Only the initial grid size uses it: the canvas
// then scales cells to fit its container (BoardCanvas's fitCellSize).
export const CELL_SIZE_PX = 28;

// Shared floor-at-20 math, factored out so it can be applied either to the
// raw window (first-paint guess, before anything has actually laid out) or
// to a measured container's real content-box size (see
// computeBoardSize below and its caller in workspace.tsx).
export function computeBoardSizeFromDimensions(
  widthPx: number,
  heightPx: number
): { rows: number; columns: number } {
  const rows =
    Math.floor(heightPx / CELL_SIZE_PX) >= 20
      ? Math.floor(heightPx / CELL_SIZE_PX)
      : 20;
  const columns =
    Math.floor(widthPx / CELL_SIZE_PX) >= 20
      ? Math.floor(widthPx / CELL_SIZE_PX)
      : 20;
  return { rows, columns };
}

// First-paint guess only, based on the full window - it ignores the side
// panel/padding/gaps around the board, so it's always an overestimate of
// the board's actual available space. workspace.tsx immediately
// corrects this via a layout effect that measures the real board
// container and calls computeBoardSizeFromDimensions with its actual size,
// before the browser paints - this window-based guess only exists so
// something renders on the very first render, before that container can be
// measured.
export function computeBoardSize(): { rows: number; columns: number } {
  return computeBoardSizeFromDimensions(window.innerWidth, window.innerHeight);
}

// Placed one cell inside the outer border (which every maze walls) rather
// than on it - a border cell only has 2-3 real neighbors instead of 4, which
// lets the maze wall it in completely even though Recursive Division's
// exclusion-zone logic guarantees connectivity for the interior region.
export function randomStartCoordinate(
  rows: number,
  columns: number
): Coordinate {
  return {
    row: rows - 2,
    column: randomInt(Math.random, 1, Math.floor(columns / 2)),
  };
}

export function randomGoalCoordinate(
  rows: number,
  columns: number
): Coordinate {
  return {
    row: 1,
    column: randomInt(Math.random, Math.floor(columns / 2), columns - 2),
  };
}

// The speed slider (0-100) maps to milliseconds per animation step, and
// from that to the Player's rate (steps per second, speedToRate): higher
// speed, shorter step. The range (2-40 ms per step, 25-500 steps/s) matches
// the original timer-driven app, so the default feels the same.
export const MIN_STEP_DELAY = 2;
export const MAX_STEP_DELAY = 40;
export const DEFAULT_SPEED = 80; // ~10 ms per step (100 steps/s), the original default

export function speedToStepDelay(speed: number): number {
  const t = 1 - speed / 100;
  return Math.round(MIN_STEP_DELAY + t * (MAX_STEP_DELAY - MIN_STEP_DELAY));
}

/** Playback speed in ticks (animation steps) per second for a slider position. */
export function speedToRate(speed: number): number {
  return 1000 / speedToStepDelay(speed);
}

/** Flat cell index of a coordinate on a board `columns` wide. */
export function toCellIndex(coordinate: Coordinate, columns: number): number {
  return coordinate.row * columns + coordinate.column;
}
