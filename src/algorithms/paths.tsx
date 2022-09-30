import React from 'react';
import { PriorityQueueAscend } from '../util/structure-util';
import { getEuclideanDistance } from '../util/function-util';
import { CoordinateAndDirection } from "../models/models";

/**
 * 
 * @param rows - total number of rows for the board
 * @param columns - total number of columns for the board
 * @param currentPosition - current position being evaluated
 * @returns array containing all the possible moves that can be made from the current position (only the 4 cardinal directions)
 */
function findChildrenMoves(rows: number, columns: number, currentPosition: { row: number, column: number }): CoordinateAndDirection[] {
  let childrenPositions: CoordinateAndDirection[] = [];

  // Top move
  if(currentPosition.row-1 >= 0) {
    let children = {
      row: currentPosition.row-1,
      column: currentPosition.column,
      direction: "up"
    }
    childrenPositions.push(children);
  }
    
  // Right move
  if(currentPosition.column+1 <= columns-1) {
    let children = {
      row: currentPosition.row,
      column: currentPosition.column+1,
      direction: "right"
    }
    childrenPositions.push(children);
  }
    
  // Down move
  if(currentPosition.row+1 <= rows-1) {
    let children = {
      row: currentPosition.row+1,
      column: currentPosition.column,
      direction: "down"
    }
    childrenPositions.push(children);
  }
    
  // Left move
  if(currentPosition.column-1 >= 0) {
    let children = {
      row: currentPosition.row,
      column: currentPosition.column-1,
      direction: "left"
    }
    childrenPositions.push(children);
  }
  return childrenPositions;
}

/**
 * 
 * @param start - start coordinate
 * @param goal - goal coordinate
 * @returns - boolean indicating whether the start coordinate is the goal coordinate
 */
function checkStartIsGoal(start: CoordinateAndDirection, goal: CoordinateAndDirection): boolean {
  if(start.row === goal.row && start.column === goal.column) {
    return true;
  }

  return false;
}

/**
 * 
 * @param walls - set containing all the walls on the board
 * @param parent - object containing the coordinates and path made so far for the parent
 * @returns boolean indicating if the parent coordinate is a wall
 */
function checkParentIsWall(walls: Set<string>, parent: [CoordinateAndDirection, CoordinateAndDirection[]]): boolean {
  if(walls.has(parent[0].row.toString() + "_" + parent[0].column.toString())) {
    return true;
  }

  return false;
}

/**
 * 
 * @param visited - set containing all the visited coordinates on the board
 * @param parent - object containing the coordinates and path made so far for the parent
 * @returns boolean indicating if the parent coordinate has already been visited
 */
function checkParentVisited(visited: Set<string>, parent: [CoordinateAndDirection, CoordinateAndDirection[]]): boolean {
  if(visited.has(parent[0].row.toString() + "_" + parent[0].column.toString())) {
    return true;
  }

  return false;
}

/**
 * 
 * @param goal - goal coordinate
 * @param parent - start coordinate
 * @returns boolean indicating if the parent coordinate is the goal coordinate
 */
function checkParentIsGoal(goal: CoordinateAndDirection, parent: [CoordinateAndDirection, CoordinateAndDirection[]]): boolean {
  if(parent[0].row === goal.row && parent[0].column === goal.column) {
    return true;
  }

  return false;
}

/**
 * 
 * @param walls - set containing all the walls of the board
 * @param child - child coordinate
 * @returns boolean indicating if a child coordinate is a wall
 */
function checkChildIsWall(walls: Set<string>, child: CoordinateAndDirection): boolean {
  if(walls.has(child.row.toString() + "_" + child.column.toString())) {
    return true;
  }

  return false;
}

/**
 * 
 * @param visited - set containing all the visited coordinates on the board
 * @param child - child coordinate
 * @returns boolean indicating if the child coordinate has been visited
 */
function checkChildVisited(visited: Set<string>, child: CoordinateAndDirection): boolean {
  if(visited.has(child.row.toString() + "_" + child.column.toString())) {
    return true
  }

  return false;
}

/**
 * 
 * @param goal - goal coordinate
 * @param child - child coordinate
 * @returns boolean indicating if child coordinate is the goal coordinate
 */
function checkChildIsGoal(goal: CoordinateAndDirection, child: CoordinateAndDirection): boolean {
  if(child.row === goal.row && child.column === goal.column) {
    return true;
  }

  return false;
}

/**
 * 
 * @param columns - total number of columns on the board
 * @param path - the path taken from the start coordinate to the goal coordinate
 * @param fillDelay - delay used by setTimeouts to fill the board for the end path
 * @param boardRef - list containing the JSX elements that make up the board
 * @param timeoutIdsRef - list containing timeout IDS for filling the board
 * @returns none
 */
function showGoalPathLine( 
  columns: number,
  path: [CoordinateAndDirection, CoordinateAndDirection[]],
  fillDelay: number,
  boardRef: React.MutableRefObject<HTMLTableCellElement[]>,
  timeoutIdsRef: React.MutableRefObject<NodeJS.Timeout[]>
): void {
  let timeDelay = fillDelay;

  // Fill in the goal path at the end
  for (let i=0; i<path[1].length; i++) {
    if(i === 0 || i === path[1].length-1) {
      continue;
    }
    else {
      const newTimeoutId = setTimeout(() => {
          boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " goal-path-fill";
          timeoutIdsRef.current.shift();
        },
        timeDelay
      );
      timeoutIdsRef.current.push(newTimeoutId);

      // Set direction for the goal in order to determine the type of path to draw
      if(i+1 === path[1].length-1) {
        if(path[1][i].row > path[1][i+1].row) {
          path[1][i+1].direction = "up";
        }
        else if(path[1][i].row < path[1][i+1].row) {
          path[1][i+1].direction = "down";
        }
        else if(path[1][i].column > path[1][i+1].column) {
          path[1][i+1].direction = "left";
        }
        else if(path[1][i].column < path[1][i+1].column) {
          path[1][i+1].direction = "right";
        }
      }

      if(path[1][i].direction === "up") { // Up direction paths
        const newTimeoutId = setTimeout(() => {
            if(i+1 >= 0 && i+1 <= path[1].length-1) {
              if(path[1][i+1].direction === "left") {
                boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " right-to-down-path";
              }
              else if(path[1][i+1].direction === "right") {
                boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " left-to-down-path";
              }
              else {
                boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " vertical-path";
              }
            }
            timeoutIdsRef.current.shift();
          },
          timeDelay + ((path[1].length) * 10)
        );
        timeoutIdsRef.current.push(newTimeoutId);
      }
      else if(path[1][i].direction === "down") { // Down direction paths
        const newTimeoutId = setTimeout(() => {
            if(i+1 >= 0 && i+1 <= path[1].length-1) {
              if(path[1][i+1].direction === "left") {
                boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " right-to-up-path";
              }
              else if(path[1][i+1].direction === "right") {
                boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " left-to-up-path";
              }
              else {
                boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " vertical-path";
              }
            }
            timeoutIdsRef.current.shift();
          },
          timeDelay + ((path[1].length) * 10)
        );
        timeoutIdsRef.current.push(newTimeoutId);
      }
      else if(path[1][i].direction === "left") { // Left direction paths
        const newTimeoutId = setTimeout(() => {
            if(i+1 >= 0 && i+1 <= path[1].length-1) {
              if(path[1][i+1].direction === "up") {
                boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " left-to-up-path";
              }
              else if(path[1][i+1].direction === "down") {
                boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " left-to-down-path";
              }
              else {
                boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " horizontal-path";
              }
            }
            timeoutIdsRef.current.shift();
          },
          timeDelay + ((path[1].length) * 10)
        );
        timeoutIdsRef.current.push(newTimeoutId);
      }
      else if(path[1][i].direction === "right") { // Right direction paths
        const newTimeoutId = setTimeout(() => {
            if(i+1 >= 0 && i+1 <= path[1].length-1) {
              if(path[1][i+1].direction === "up") {
                boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " right-to-up-path";
              }
              else if(path[1][i+1].direction === "down") {
                boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " right-to-down-path";
              }
              else {
                boardRef.current[(path[1][i].row * columns) + path[1][i].column].className += " horizontal-path";
              }
            }
            timeoutIdsRef.current.shift();
          },
          timeDelay + ((path[1].length) * 10)
        );
        timeoutIdsRef.current.push(newTimeoutId);
      }
      else {
        continue;
      }
      timeDelay += 10;
    }
  }
}

/**
 * 
 * @param rows - total number of rows for the board
 * @param columns - total number of columns for the board
 * @param start - start coordinate
 * @param goal - goal coordinate
 * @param walls - set containing all the walls of the board
 * @param algoType - string indicating the type of unweighted algorithm
 * @param boardRef - list containing the JSX elements that make up the board
 * @param timeoutIdsRef - list containing timeout IDS for filling the board
 * @returns path from start coordinate to goal coordinate in an unweighted search
 */
function unweightedSearch(
  rows: number,
  columns: number,
  start: CoordinateAndDirection,
  goal: CoordinateAndDirection,
  walls: Set<string>,
  algoType: string,
  boardRef: React.MutableRefObject<HTMLTableCellElement[]>,
  timeoutIdsRef: React.MutableRefObject<NodeJS.Timeout[]>
): CoordinateAndDirection[] | null {
  
  const queue: [CoordinateAndDirection, CoordinateAndDirection[]][] = [];
  const path: CoordinateAndDirection[] = [];
  const visited = new Set<string>();
  let fillDelay = 10;

  // if start state is the goal state
  if(checkStartIsGoal(start, goal)) {
  	return path;
  }
  
  // Add start state to the queue
  queue.push([start, path]);

  while (queue.length) {
    // Pop the top of the queue
    const parent = queue.shift();

    if(parent) {
      // If we are at the goal, return the path
      // Else, continue adding to the queue, finding children moves, etc
      if (checkParentIsGoal(goal, parent)) {
        parent[1].push(goal);

        // Fill the goal path at the end
        showGoalPathLine(columns, parent, fillDelay, boardRef, timeoutIdsRef);
        return parent[1];
      }
      else {
        // if parent position is a wall or is already visited, continue
        // Else, find children and add to queue, add parent position to visited
        if(checkParentIsWall(walls, parent) || checkParentVisited(visited, parent)) {
          continue;
        }
        else {
          const children = findChildrenMoves(rows, columns, parent[0]);
          for (let i=0; i<children.length; i++) {
            const newPath = [...parent[1]];
            newPath.push(parent[0]);

            // // If one of the children is the goal, return the goal
            // if(children[i].row === goal.row && children[i].column === goal.column) {
            //   newPath.push(goal);

            //   // Fill the goal path at the goal
            //   showGoalPathLine(columns, [children[i], newPath], fillDelay, boardRef, timeoutIdsRef, setShowGoalPath);
            //   return newPath;
            // }

            // Check if breath-first or depth-first
            if(algoType === "BreadthFirstSearch") {
              queue.push([children[i], newPath]);
            }
            else {
              queue.unshift([children[i], newPath]);
            }

            // if child position is not a wall, visited, or goal, color it in
            if(!checkChildVisited(visited, children[i]) && !checkChildIsWall(walls, children[i]) && !checkChildIsGoal(goal, children[i])) {
              const newTimeoutId = setTimeout(() => {
                  boardRef.current[(children[i].row * columns) + children[i].column].className += " board-fill";
                  timeoutIdsRef.current.shift();
                },
                fillDelay
              );
              timeoutIdsRef.current.push(newTimeoutId);
              fillDelay += 10;
            }
          }

          // Add parent position to visited
          visited.add(parent[0].row.toString() + "_" + parent[0].column.toString());
        }
      }
    }
  }

  // if we reach here, it means that there are no possible paths to the goal
  return null;
}

/**
 * 
 * @param rows - total number of rows for the board
 * @param columns - total number of columns for the board
 * @param start - start coordinate
 * @param goal - goal coordinate
 * @param walls - set containing all the walls of the board
 * @param algoType - string indicating the type of weighted algorithm
 * @param boardRef - list containing the JSX elements that make up the board
 * @param timeoutIdsRef - list containing timeout IDS for filling the board
 * @returns path from start coordinate to goal coordinate in an weighted search
 */
function weightedSearch(
  rows: number,
  columns: number,
  start: CoordinateAndDirection,
  goal: CoordinateAndDirection,
  walls: Set<string>,
  algoType: string,
  boardRef: React.MutableRefObject<HTMLTableCellElement[]>,
  timeoutIdsRef: React.MutableRefObject<NodeJS.Timeout[]>
): CoordinateAndDirection[] | null {

  const queue = new PriorityQueueAscend();
  const path: CoordinateAndDirection[] = [];
  const visited = new Set<string>();
  let fillDelay = 10;

  // if start state is the goal state
  if(checkStartIsGoal(start, goal)) {
  	return path;
  }
  
  // Add start state to the queue
  queue.push([start, path], 0);

  while (!queue.isEmpty()) {
    // Pop the top of the queue
    const parent = queue.pop();

    if(parent) {
      // if we are at the goal, return the path
      // Else, continue adding to the queue, finding children moves, etc
      if(checkParentIsGoal(goal, parent.item)) {
        parent.item[1].push(goal);

        // Fill in the goal path at the end
        showGoalPathLine(columns, parent.item, fillDelay, boardRef, timeoutIdsRef);
        return parent.item[1];
      }
      else {
        // if parent position is a wall or is already visited, continue
        // Else, find children and add to queue, add parent position to visited
        if(checkParentIsWall(walls, parent.item) || checkParentVisited(visited, parent.item)) {
          continue;
        }
        else {
          const children = findChildrenMoves(rows, columns, parent.item[0]);
          for (let i=0; i<children.length; i++) {
            const newPath = [...parent.item[1]];
            newPath.push(parent.item[0]);

            if(algoType === "GreedyBestFirstSearch") {
              const h = getEuclideanDistance(children[i], goal);
              queue.push([children[i], newPath], h);
            }
            else if(algoType === "DijkstrasAlgorithm") {
              queue.push([children[i], newPath], parent.priority + 1);
            }
            else if(algoType === "AStarAlgorithm") {
              const g = parent?.priority + 1;
              const h = getEuclideanDistance(children[i], goal);
              const f = g + h;
              queue.push([children[i], newPath], f);
            }

            // if child position is not a wall, visited, or goal, color it in
            if(!checkChildVisited(visited, children[i]) && !checkChildIsWall(walls, children[i]) && !checkChildIsGoal(goal, children[i])) {
              const newTimeoutId = setTimeout(() => {
                  boardRef.current[(children[i].row * columns) + children[i].column].className += " board-fill";
                  timeoutIdsRef.current.shift();
                },
                fillDelay
              );
              timeoutIdsRef.current.push(newTimeoutId);
              fillDelay += 10;
            }
          }

          // Add parent position to visited
          visited.add(parent?.item[0].row.toString() + "_" + parent?.item[0].column.toString());
        }
      }
    }
  }

  // if we reach here, it means that there are no possible paths to the goal
  return null;
}

export {
  unweightedSearch,
  weightedSearch
};