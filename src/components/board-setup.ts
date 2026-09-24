import { randomInt } from '../engine';

export interface Coordinate {
  row: number;
  column: number;
}

// Computes the board size (rows/columns) from the current viewport.
// 28px matches board-cell's fixed size in index.css (1.75rem, border-box) -
// keep these in sync so the computed grid actually fills the viewport
// instead of leaving a gap or overflowing.
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

// Higher slider value = faster animation, so the step delay it maps to
// (what the algorithms actually use) runs the other way: a bigger slider
// value means a smaller delay-per-step.
export const MIN_STEP_DELAY = 2;
export const MAX_STEP_DELAY = 40;
export const DEFAULT_SPEED = 80; // 0-100 slider position; 80 maps close to the original hardcoded 10ms step

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
