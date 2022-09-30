import { evenRandIntBetween, oddRandIntBetween } from '../util/function-util';
import { CoordinateAndDirection } from "../models/models";

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
 * 
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

  // if no more walls can be built, return
  if(maxX-x < 1 || maxY-y < 1) return;

  // Determine whether a horizontal or vertical wall should be built
  // i.e. if an area is wider (left to right), vertical walls are preferred,
  // and if an area is longer (top to bottom), horizontal walls are preferred
  const horizontalOrientation = getHorizontalOrientation(maxX-x, maxY-y);

  if(horizontalOrientation) {
    // Wall should be on an even row
    const wallY = evenRandIntBetween(y, maxY);

    // Opening should be on an odd column
    const openingX = oddRandIntBetween(x, maxX);

    // Fill walls
    for(let i=x; i<=maxX; i++) {
      if(!(openingX === i)
        && !(goal.column === i && goal.row === wallY)
        && !(start.column === i && start.row === wallY)
        && !(start.column === i && start.row === wallY+1)
        && !(goal.column === i && goal.row === wallY-1)
      ) {
        setTimeout(() => 
          buildWall(wallY, i),
            fillDelay
          );
        fillDelay += 10;
      }
    }

    // Decrease area and recurse
    recursiveDivision(fillDelay, start, goal, maxRows, maxColumns, y, x, wallY-1, maxX, buildWall);
    recursiveDivision(fillDelay, start, goal, maxRows, maxColumns, wallY+1, x, maxY, maxX, buildWall);
  }
  else {
    // Wall should be on an even column
    const wallX = evenRandIntBetween(x, maxX);

    // Opening should be on an odd row
    const openingY = oddRandIntBetween(y, maxY);

    // Fill walls
    for(let i=y; i<=maxY; i++) {
      if(!(openingY === i)
        && !(goal.row === i && goal.column === wallX)
        && !(start.row === i && start.column === wallX)
        && !(start.column === wallX && start.row === i+1)
        && !(goal.column === wallX && goal.row === i-1)
      ) {
        setTimeout(() => 
          buildWall(i, wallX),
            fillDelay
          );
        fillDelay += 10;
      }
    }

    // Decrease area and recurse
    recursiveDivision(fillDelay, start, goal, maxRows, maxColumns, y, x, maxY, wallX-1, buildWall);
    recursiveDivision(fillDelay, start, goal, maxRows, maxColumns, y, wallX+1, maxY, maxX, buildWall);
  }
}

/**
 * 
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

  // if no more walls can be built, return
  if(maxX-x <= 2|| maxY-y <= 2) return;

  // Determine whether a horizontal or vertical wall should be built
  // i.e. if an area is wider (left to right), vertical walls are preferred,
  // and if an area is longer (top to bottom), horizontal walls are preferred
  const horizontalOrientation = getHorizontalOrientation(maxX-x, maxY-y);

  if(horizontalOrientation) {
    // Wall should be on an even row
    const wallY = evenRandIntBetween(y, maxY);

    // Opening should be on an odd column
    const openingX = oddRandIntBetween(x, maxX);

    // Fill walls
    for(let i=x; i<=maxX; i++) {
      if(!(openingX === i)
        && !(goal.column === i && goal.row === wallY)
        && !(start.column === i && start.row === wallY)
        && !(start.column === i && start.row === wallY+1)
        && !(goal.column === i && goal.row === wallY-1)
        && !(goal.column === i && goal.row === wallY+1)
        && !(start.column === i && start.row === wallY+1)
        && !(start.column === i && start.row === wallY+2)
        && !(goal.column === i && goal.row === wallY-2)
      ) {
        setTimeout(() => 
          buildWall(wallY, i),
            fillDelay
          );
        setTimeout(() => 
          buildWall(wallY+1, i),
            fillDelay
          );
        fillDelay += 10;
      }
    }

    // Decrease area and recurse
    recursiveDivisionTwoLayers(fillDelay, start, goal, maxRows, maxColumns, y, x, wallY-3, maxX, buildWall);
    recursiveDivisionTwoLayers(fillDelay, start, goal, maxRows, maxColumns, wallY+3, x, maxY, maxX, buildWall);
  }
  else {
    // Wall should be on an even column
    const wallX = evenRandIntBetween(x, maxX);

    // Opening should be on an odd row
    const openingY = oddRandIntBetween(y, maxY);

    // Fill walls
    for(let i=y; i<=maxY; i++) {
      if(!(openingY === i)
        && !(goal.row === i && goal.column === wallX)
        && !(start.row === i && start.column === wallX)
        && !(start.column === wallX && start.row === i+1)
        && !(goal.column === wallX && goal.row === i-1)
        && !(goal.row === i && goal.column === wallX+1)
        && !(start.row === i && start.column === wallX+1)
        && !(start.column === wallX+1 && start.row === i+1)
        && !(goal.column === wallX+1 && goal.row === i-1)
      ) {
        setTimeout(() => 
          buildWall(i, wallX),
            fillDelay
          );
        setTimeout(() => 
          buildWall(i, wallX+1),
            fillDelay
          );
        fillDelay += 10;
      }
    }

    // Decrease area and recurse
    recursiveDivisionTwoLayers(fillDelay, start, goal, maxRows, maxColumns, y, x, maxY, wallX-3, buildWall);
    recursiveDivisionTwoLayers(fillDelay, start, goal, maxRows, maxColumns, y, wallX+3, maxY, maxX, buildWall);
  }
}

export {
  recursiveDivision,
  recursiveDivisionTwoLayers,
  drawBorderWalls
}