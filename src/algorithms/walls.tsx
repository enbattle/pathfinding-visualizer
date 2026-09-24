import { evenRandIntBetween, oddRandIntBetween } from '../util/function-util';
import type { CoordinateAndDirection, ScheduleTimeout } from "../models/models";

/**
 *
 * @param start - start coordinate
 * @param goal - goal coordinate
 * @param maxRows - total number of rows on the board
 * @param maxColumns - total number of columns on the board
 * @param buildWall - function that builds a wall on the board given a coordinate
 * @param scheduleTimeout - schedules each animated wall placement (caller owns cancellation)
 */
function drawBorderWalls(
  start: CoordinateAndDirection,
  goal: CoordinateAndDirection,
  maxRows: number,
  maxColumns: number,
  buildWall: (rowCoordinate: number, columnCoordinate: number) => void,
  scheduleTimeout: ScheduleTimeout,
  stepDelay: number = 10
): void {

  let fillDelay = 0;

  for(let i=0; i<maxRows; i++) {
    if(!(start.row === i && start.column === 0)
      && !(goal.row === i && goal.column === 0))

      scheduleTimeout(() =>
        buildWall(i, 0),
        fillDelay
      );
      fillDelay += stepDelay;
  }

  for(let i=0; i<maxColumns; i++) {
    if(!(start.row === maxRows-1 && start.column === i)
      && !(goal.row === maxRows-1 && goal.column === i))

      scheduleTimeout(() =>
        buildWall(maxRows-1, i),
        fillDelay
      );
      fillDelay += stepDelay;
  }

  for(let i=maxRows-1; i>=0; i--) {
    if(!(start.row === i && start.column === maxColumns-1)
      && !(goal.row === i && goal.column === maxColumns-1))

      scheduleTimeout(() =>
      buildWall(i, maxColumns-1),
        fillDelay
      );
      fillDelay += stepDelay;
  }

  for(let i=maxColumns-1; i>=0; i--) {
    if(!(start.row === 0 && start.column === i)
      && !(goal.row === 0 && goal.column === i))

      scheduleTimeout(() =>
        buildWall(0, i),
        fillDelay
      );
      fillDelay += stepDelay;
  }
}

/**
 *
 * @param horizontalWidth - horizontal subsection of the board
 * @param verticalLength - vertical subsection of the board
 * @returns boolean determining whether to build a horizontal or vertical wall
 *  (i.e. if wall is wider, cut vertically, if wall is longer, cut horizontally)
 */
function getHorizontalOrientation(horizontalWidth: number, verticalLength: number): boolean {
  if(horizontalWidth > verticalLength) return false;
  else if(horizontalWidth < verticalLength) return true;
  else return Math.random() < 0.5 ? true : false;
}

/**
 * Recursively partitions the board, laying a wall of `wallThickness` cells
 * across the shorter dimension of each partition (with a single-cell
 * opening) and recursing into the two halves left behind, until a partition
 * is too small to keep dividing. recursiveDivision/recursiveDivisionTwoLayers
 * below are both thin wrappers over this, differing only in thickness.
 *
 * @param wallThickness - how many cells thick the dividing wall is
 * @param fillDelay - starting delay (ms) for this call's scheduled wall placements for the end path
 * @param start - start coordinate
 * @param goal - goal coordinate
 * @param y - current minimum y value (row)
 * @param x - current minimum x value (column)
 * @param maxY - current maximum y value (row)
 * @param maxX - current maximum x value (column)
 * @param buildWall - function to build a wall on the board
 * @param scheduleTimeout - schedules each animated wall placement (caller owns cancellation)
 * @param stepDelay - ms added to fillDelay per animated wall placement (speed control)
 * @returns none
 */
function buildDividingWalls(
  wallThickness: number,
  fillDelay: number,
  start: CoordinateAndDirection,
  goal: CoordinateAndDirection,
  maxRows: number,
  maxColumns: number,
  y: number,
  x: number,
  maxY: number,
  maxX: number,
  buildWall: (rowCoordinate: number, columnCoordinate: number) => void,
  scheduleTimeout: ScheduleTimeout,
  stepDelay: number = 10
): void {

  // A wall this thick needs this much room on either side of it before the
  // next partition can start - below that, stop dividing this partition.
  const partitionOffset = 2 * wallThickness - 1;

  // if no more walls can be built, return
  if(maxX-x < partitionOffset || maxY-y < partitionOffset) return;

  // Determine whether a horizontal or vertical wall should be built
  // i.e. if an area is wider (left to right), vertical walls are preferred,
  // and if an area is longer (top to bottom), horizontal walls are preferred
  const horizontalOrientation = getHorizontalOrientation(maxX-x, maxY-y);

  // Is `position` within the safety buffer around a wall starting at
  // `wallStart`? Cells here are skipped when laying the wall so start/goal
  // never end up boxed in directly against it.
  const inSafetyBuffer = (position: number, wallStart: number) =>
    Math.abs(position - wallStart) <= wallThickness;

  // True when start/goal's own row (or column, for vertical walls) falls
  // *inside* the wall's thickness-span rather than merely being adjacent to
  // it - i.e. the wall would otherwise run directly through the cell
  // start/goal sits on. A single-cell opening at its own column (row) isn't
  // enough in that case: the cells immediately beside it *in that same wall
  // line* are still walled, which seals off its only remaining access
  // along the line. Widening the exclusion to those neighbors too is what
  // guarantees start/goal always keeps at least one open side.
  const isEmbeddedInWall = (position: number, wallStart: number) =>
    position >= wallStart && position < wallStart + wallThickness;

  if(horizontalOrientation) {
    // Wall should be on an even row
    const wallY = evenRandIntBetween(y, maxY);

    // Opening should be on an odd column
    const openingX = oddRandIntBetween(x, maxX);

    // Fill walls
    for(let i=x; i<=maxX; i++) {
      const isOpening = openingX === i;
      const wouldTrapStart = inSafetyBuffer(start.row, wallY) &&
        (isEmbeddedInWall(start.row, wallY) ? Math.abs(i - start.column) <= 1 : i === start.column);
      const wouldTrapGoal = inSafetyBuffer(goal.row, wallY) &&
        (isEmbeddedInWall(goal.row, wallY) ? Math.abs(i - goal.column) <= 1 : i === goal.column);

      if(!isOpening && !wouldTrapStart && !wouldTrapGoal) {
        for(let layer=0; layer<wallThickness; layer++) {
          scheduleTimeout(() =>
            buildWall(wallY + layer, i),
            fillDelay
          );
        }
        fillDelay += stepDelay;
      }
    }

    // Decrease area and recurse
    buildDividingWalls(wallThickness, fillDelay, start, goal, maxRows, maxColumns, y, x, wallY-partitionOffset, maxX, buildWall, scheduleTimeout, stepDelay);
    buildDividingWalls(wallThickness, fillDelay, start, goal, maxRows, maxColumns, wallY+partitionOffset, x, maxY, maxX, buildWall, scheduleTimeout, stepDelay);
  }
  else {
    // Wall should be on an even column
    const wallX = evenRandIntBetween(x, maxX);

    // Opening should be on an odd row
    const openingY = oddRandIntBetween(y, maxY);

    // Fill walls
    for(let i=y; i<=maxY; i++) {
      const isOpening = openingY === i;
      const wouldTrapStart = inSafetyBuffer(start.column, wallX) &&
        (isEmbeddedInWall(start.column, wallX) ? Math.abs(i - start.row) <= 1 : i === start.row);
      const wouldTrapGoal = inSafetyBuffer(goal.column, wallX) &&
        (isEmbeddedInWall(goal.column, wallX) ? Math.abs(i - goal.row) <= 1 : i === goal.row);

      if(!isOpening && !wouldTrapStart && !wouldTrapGoal) {
        for(let layer=0; layer<wallThickness; layer++) {
          scheduleTimeout(() =>
            buildWall(i, wallX + layer),
            fillDelay
          );
        }
        fillDelay += stepDelay;
      }
    }

    // Decrease area and recurse
    buildDividingWalls(wallThickness, fillDelay, start, goal, maxRows, maxColumns, y, x, maxY, wallX-partitionOffset, buildWall, scheduleTimeout, stepDelay);
    buildDividingWalls(wallThickness, fillDelay, start, goal, maxRows, maxColumns, y, wallX+partitionOffset, maxY, maxX, buildWall, scheduleTimeout, stepDelay);
  }
}

/**
 * Single-cell-thick recursive division - see buildDividingWalls.
 */
function recursiveDivision(
  fillDelay: number,
  start: CoordinateAndDirection,
  goal: CoordinateAndDirection,
  maxRows: number,
  maxColumns: number,
  y: number,
  x: number,
  maxY: number,
  maxX: number,
  buildWall: (rowCoordinate: number, columnCoordinate: number) => void,
  scheduleTimeout: ScheduleTimeout,
  stepDelay: number = 10
): void {
  buildDividingWalls(1, fillDelay, start, goal, maxRows, maxColumns, y, x, maxY, maxX, buildWall, scheduleTimeout, stepDelay);
}

/**
 * Two-cell-thick recursive division - see buildDividingWalls.
 */
function recursiveDivisionTwoLayers(
  fillDelay: number,
  start: CoordinateAndDirection,
  goal: CoordinateAndDirection,
  maxRows: number,
  maxColumns: number,
  y: number,
  x: number,
  maxY: number,
  maxX: number,
  buildWall: (rowCoordinate: number, columnCoordinate: number) => void,
  scheduleTimeout: ScheduleTimeout,
  stepDelay: number = 10
): void {
  buildDividingWalls(2, fillDelay, start, goal, maxRows, maxColumns, y, x, maxY, maxX, buildWall, scheduleTimeout, stepDelay);
}

/**
 * Randomized Prim's algorithm - grows a random spanning tree over a
 * "chamber" lattice (every 2nd cell in each dimension, relative to the
 * interior's top-left corner) rather than carving every individual cell,
 * so the result reads as a proper maze (walls remain between passages)
 * instead of an all-open board - a structurally different, organic/
 * branching look versus Recursive Division's blocky partitions.
 *
 * Connectivity is guaranteed by construction, not by chance: start and
 * goal are each explicitly wired into the lattice via a short carved
 * connector (needed since they won't generally land exactly on a chamber
 * cell), and the chamber lattice itself is always fully connected - a
 * spanning tree grown from one chamber always reaches every other chamber,
 * since the underlying chamber grid is itself fully connected via
 * cardinal adjacency. So start and goal are always mutually reachable
 * through (their own connector) -> (the spanning tree) -> (the other's
 * connector).
 *
 * @param fillDelay - starting delay (ms) for this call's scheduled wall placements
 * @param start - start coordinate
 * @param goal - goal coordinate
 * @param maxRows - total number of rows on the board (unused; kept for call-site parity with recursiveDivision/recursiveDivisionTwoLayers)
 * @param maxColumns - total number of columns on the board (unused; see above)
 * @param y - current minimum y value (row) of the interior region
 * @param x - current minimum x value (column) of the interior region
 * @param maxY - current maximum y value (row) of the interior region
 * @param maxX - current maximum x value (column) of the interior region
 * @param buildWall - function to build a wall on the board
 * @param scheduleTimeout - schedules each animated wall placement (caller owns cancellation)
 * @param stepDelay - ms added to fillDelay per animated wall placement (speed control)
 */
function prims(
  fillDelay: number,
  start: CoordinateAndDirection,
  goal: CoordinateAndDirection,
  maxRows: number,
  maxColumns: number,
  y: number,
  x: number,
  maxY: number,
  maxX: number,
  buildWall: (rowCoordinate: number, columnCoordinate: number) => void,
  scheduleTimeout: ScheduleTimeout,
  stepDelay: number = 10
): void {
  const key = (r: number, c: number) => r + "_" + c;

  const carved = new Set<string>();

  // Carves a short straight connector from an arbitrary interior cell to
  // the nearest chamber cell (fixing row parity, then column parity, one
  // step at a time) so start/goal always end up wired into the lattice
  // even when they don't land on a chamber cell themselves.
  const connectToLattice = (row: number, column: number): void => {
    let r = row;
    let c = column;
    carved.add(key(r, c));

    if ((r - y) % 2 !== 0) {
      r = r + 1 <= maxY ? r + 1 : r - 1;
      carved.add(key(r, c));
    }
    if ((c - x) % 2 !== 0) {
      c = c + 1 <= maxX ? c + 1 : c - 1;
      carved.add(key(r, c));
    }
  };

  connectToLattice(start.row, start.column);
  connectToLattice(goal.row, goal.column);

  const chamberRows: number[] = [];
  for (let r = y; r <= maxY; r += 2) chamberRows.push(r);
  const chamberColumns: number[] = [];
  for (let c = x; c <= maxX; c += 2) chamberColumns.push(c);

  if (chamberRows.length > 0 && chamberColumns.length > 0) {
    const visited = new Set<string>();
    // Each frontier entry is a not-yet-visited chamber, and the
    // already-visited chamber it would be carved in from.
    const frontier: { row: number; column: number; fromRow: number; fromColumn: number }[] = [];

    const addFrontier = (row: number, column: number): void => {
      const neighbors: [number, number][] = [
        [row - 2, column],
        [row + 2, column],
        [row, column - 2],
        [row, column + 2]
      ];
      for (const [nr, nc] of neighbors) {
        if (nr >= y && nr <= maxY && nc >= x && nc <= maxX && !visited.has(key(nr, nc))) {
          frontier.push({ row: nr, column: nc, fromRow: row, fromColumn: column });
        }
      }
    };

    const startChamberRow = chamberRows[Math.floor(Math.random() * chamberRows.length)];
    const startChamberColumn = chamberColumns[Math.floor(Math.random() * chamberColumns.length)];

    visited.add(key(startChamberRow, startChamberColumn));
    carved.add(key(startChamberRow, startChamberColumn));
    addFrontier(startChamberRow, startChamberColumn);

    while (frontier.length > 0) {
      const index = Math.floor(Math.random() * frontier.length);
      const { row, column, fromRow, fromColumn } = frontier[index];
      frontier.splice(index, 1);

      if (visited.has(key(row, column))) continue;

      visited.add(key(row, column));
      carved.add(key(row, column));
      // The connector cell sits exactly between the chamber being carved
      // in and the already-visited chamber it's being carved in from.
      carved.add(key((row + fromRow) / 2, (column + fromColumn) / 2));

      addFrontier(row, column);
    }
  }

  // Every interior cell that never got carved open is a wall.
  let delay = fillDelay;
  for (let r = y; r <= maxY; r++) {
    for (let c = x; c <= maxX; c++) {
      const isStart = start.row === r && start.column === c;
      const isGoal = goal.row === r && goal.column === c;
      if (!carved.has(key(r, c)) && !isStart && !isGoal) {
        scheduleTimeout(() => buildWall(r, c), delay);
        delay += stepDelay;
      }
    }
  }
}

export {
  recursiveDivision,
  recursiveDivisionTwoLayers,
  prims,
  drawBorderWalls
}
