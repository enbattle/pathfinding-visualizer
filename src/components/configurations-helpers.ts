import { randIntBetween } from '../util/function-util';
import type { CoordinateAndDirection } from '../models/models';

// Computes the board size (rows/columns) from the current viewport.
// 28px matches board-cell's fixed size in index.css (1.75rem, border-box) -
// keep these in sync so the computed grid actually fills the viewport
// instead of leaving a gap or overflowing.
export const CELL_SIZE_PX = 28;

export function computeBoardSize(): { rows: number; columns: number } {
  const rows = Math.floor(window.innerHeight / CELL_SIZE_PX) >= 20 ? Math.floor(window.innerHeight / CELL_SIZE_PX) : 20;
  const columns = Math.floor(window.innerWidth / CELL_SIZE_PX) >= 20 ? Math.floor(window.innerWidth / CELL_SIZE_PX) : 20;
  return { rows, columns };
}

// Placed one cell inside the outer border (drawn by drawBorderWalls) rather
// than on it - a border cell only has 2-3 real neighbors instead of 4, which
// lets the maze wall it in completely even though recursiveDivision's
// exclusion-zone logic guarantees connectivity for the interior region.
export function randomStartCoordinate(rows: number, columns: number): CoordinateAndDirection {
  return {
    row: rows - 2,
    column: randIntBetween(1, Math.floor(columns / 2)),
    direction: ''
  };
}

export function randomGoalCoordinate(rows: number, columns: number): CoordinateAndDirection {
  return {
    row: 1,
    column: randIntBetween(Math.floor(columns / 2), columns - 2),
    direction: ''
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
