import { evenRandIntBetween, oddRandIntBetween } from '../util/function-util';
import type { CoordinateAndDirection } from "../models/models";

/**
 *
 * @param start - start coordinate
 * @param goal - goal coordinate
 * @param maxRows - total number of rows on the board
 * @param maxColumns - total number of columns on the board
 * @param buildWall - function that builds a wall on the board given a coordinate
 */
function drawBorderWalls(
  start: CoordinateAndDirection,
  goal: CoordinateAndDirection,
  maxRows: number,
  maxColumns: number,
  buildWall: (rowCoordinate: number, columnCoordinate: number) => void
): void {

  let fillDelay = 0;

  for(let i=0; i<maxRows; i++) {
    if(!(start.row === i && start.column === 0)
      && !(goal.row === i && goal.column === 0))

      setTimeout(() =>
        buildWall(i, 0),
        fillDelay
      );
      fillDelay += 10;
  }

  for(let i=0; i<maxColumns; i++) {
    if(!(start.row === maxRows-1 && start.column === i)
      && !(goal.row === maxRows-1 && goal.column === i))

      setTimeout(() =>
        buildWall(maxRows-1, i),
        fillDelay
      );
      fillDelay += 10;
  }

  for(let i=maxRows-1; i>=0; i--) {
    if(!(start.row === i && start.column === maxColumns-1)
      && !(goal.row === i && goal.column === maxColumns-1))

      setTimeout(() =>
      buildWall(i, maxColumns-1),
        fillDelay
      );
      fillDelay += 10;
  }

  for(let i=maxColumns-1; i>=0; i--) {
    if(!(start.row === 0 && start.column === i)
      && !(goal.row === 0 && goal.column === i))

      setTimeout(() =>
        buildWall(0, i),
        fillDelay
      );
      fillDelay += 10;
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
 * @param fillDelay - delay used by setTimeouts to fill the board for the end path
 * @param start - start coordinate
 * @param goal - goal coordinate
 * @param y - current minimum y value (row)
 * @param x - current minimum x value (column)
 * @param maxY - current maximum y value (row)
 * @param maxX - current maximum x value (column)
 * @param buildWall - function to build a wall on the board
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
  buildWall: (rowCoordinate: number, columnCoordinate: number) => void
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

  if(horizontalOrientation) {
    // Wall should be on an even row
    const wallY = evenRandIntBetween(y, maxY);

    // Opening should be on an odd column
    const openingX = oddRandIntBetween(x, maxX);

    // Fill walls
    for(let i=x; i<=maxX; i++) {
      const isOpening = openingX === i;
      const wouldTrapStart = start.column === i && inSafetyBuffer(start.row, wallY);
      const wouldTrapGoal = goal.column === i && inSafetyBuffer(goal.row, wallY);

      if(!isOpening && !wouldTrapStart && !wouldTrapGoal) {
        for(let layer=0; layer<wallThickness; layer++) {
          setTimeout(() =>
            buildWall(wallY + layer, i),
            fillDelay
          );
        }
        fillDelay += 10;
      }
    }

    // Decrease area and recurse
    buildDividingWalls(wallThickness, fillDelay, start, goal, maxRows, maxColumns, y, x, wallY-partitionOffset, maxX, buildWall);
    buildDividingWalls(wallThickness, fillDelay, start, goal, maxRows, maxColumns, wallY+partitionOffset, x, maxY, maxX, buildWall);
  }
  else {
    // Wall should be on an even column
    const wallX = evenRandIntBetween(x, maxX);

    // Opening should be on an odd row
    const openingY = oddRandIntBetween(y, maxY);

    // Fill walls
    for(let i=y; i<=maxY; i++) {
      const isOpening = openingY === i;
      const wouldTrapStart = start.row === i && inSafetyBuffer(start.column, wallX);
      const wouldTrapGoal = goal.row === i && inSafetyBuffer(goal.column, wallX);

      if(!isOpening && !wouldTrapStart && !wouldTrapGoal) {
        for(let layer=0; layer<wallThickness; layer++) {
          setTimeout(() =>
            buildWall(i, wallX + layer),
            fillDelay
          );
        }
        fillDelay += 10;
      }
    }

    // Decrease area and recurse
    buildDividingWalls(wallThickness, fillDelay, start, goal, maxRows, maxColumns, y, x, maxY, wallX-partitionOffset, buildWall);
    buildDividingWalls(wallThickness, fillDelay, start, goal, maxRows, maxColumns, y, wallX+partitionOffset, maxY, maxX, buildWall);
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
  buildWall: (rowCoordinate: number, columnCoordinate: number) => void
): void {
  buildDividingWalls(1, fillDelay, start, goal, maxRows, maxColumns, y, x, maxY, maxX, buildWall);
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
  buildWall: (rowCoordinate: number, columnCoordinate: number) => void
): void {
  buildDividingWalls(2, fillDelay, start, goal, maxRows, maxColumns, y, x, maxY, maxX, buildWall);
}

export {
  recursiveDivision,
  recursiveDivisionTwoLayers,
  drawBorderWalls
}
