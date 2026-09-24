import { Stack, Queue, PriorityItem, PriorityQueueAscend } from '../models/models';
import { getEuclideanDistance } from '../util/function-util';
import type { CoordinateAndDirection, SearchNode, ScheduleTimeout } from "../models/models";

// The animation used to mutate DOM className directly on a timer, outside
// React's render cycle. It now reports each visual change through these
// callbacks instead, so board.tsx can drive the board from real state.
interface AnimationCallbacks {
  onCellVisited: (row: number, column: number) => void;
  onGoalPathFill: (row: number, column: number) => void;
  onPathDirection: (row: number, column: number, directionClass: string) => void;
}

/**
 *
 * @param rows - total number of rows for the board
 * @param columns - total number of columns for the board
 * @param currentPosition - current position being evaluated
 * @returns array containing all the possible moves that can be made from the current position (only the 4 cardinal directions)
 */
function findChildrenMoves(rows: number, columns: number, currentPosition: { row: number, column: number }): CoordinateAndDirection[] {
  const childrenPositions: CoordinateAndDirection[] = [];

  // Top move
  if(currentPosition.row-1 >= 0) {
    const children = {
      row: currentPosition.row-1,
      column: currentPosition.column,
      direction: "up"
    }
    childrenPositions.push(children);
  }

  // Right move
  if(currentPosition.column+1 <= columns-1) {
    const children = {
      row: currentPosition.row,
      column: currentPosition.column+1,
      direction: "right"
    }
    childrenPositions.push(children);
  }

  // Down move
  if(currentPosition.row+1 <= rows-1) {
    const children = {
      row: currentPosition.row+1,
      column: currentPosition.column,
      direction: "down"
    }
    childrenPositions.push(children);
  }

  // Left move
  if(currentPosition.column-1 >= 0) {
    const children = {
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
function checkParentIsWall(walls: Set<string>, parent: SearchNode): boolean {
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
function checkParentVisited(visited: Set<string>, parent: SearchNode): boolean {
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
function checkParentIsGoal(goal: CoordinateAndDirection, parent: SearchNode): boolean {
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
 * @param scheduleTimeout - schedules a timed animation step (caller owns cancellation)
 * @param callbacks - reports each visual change so the caller can drive board state
 * @returns none
 */
function showGoalPathLine(
  columns: number,
  path: SearchNode,
  fillDelay: number,
  scheduleTimeout: ScheduleTimeout,
  callbacks: AnimationCallbacks,
  stepDelay: number
): void {
  let timeDelay = fillDelay;

  // Fill in the goal path at the end
  for (let i=0; i<path[1].length; i++) {
    if(i === 0 || i === path[1].length-1) {
      continue;
    }
    else {
      const row = path[1][i].row;
      const column = path[1][i].column;

      scheduleTimeout(() => {
          callbacks.onGoalPathFill(row, column);
        },
        timeDelay
      );

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
        scheduleTimeout(() => {
            if(i+1 >= 0 && i+1 <= path[1].length-1) {
              if(path[1][i+1].direction === "left") {
                callbacks.onPathDirection(row, column, "right-to-down-path");
              }
              else if(path[1][i+1].direction === "right") {
                callbacks.onPathDirection(row, column, "left-to-down-path");
              }
              else {
                callbacks.onPathDirection(row, column, "vertical-path");
              }
            }
          },
          timeDelay + ((path[1].length) * stepDelay)
        );
      }
      else if(path[1][i].direction === "down") { // Down direction paths
        scheduleTimeout(() => {
            if(i+1 >= 0 && i+1 <= path[1].length-1) {
              if(path[1][i+1].direction === "left") {
                callbacks.onPathDirection(row, column, "right-to-up-path");
              }
              else if(path[1][i+1].direction === "right") {
                callbacks.onPathDirection(row, column, "left-to-up-path");
              }
              else {
                callbacks.onPathDirection(row, column, "vertical-path");
              }
            }
          },
          timeDelay + ((path[1].length) * stepDelay)
        );
      }
      else if(path[1][i].direction === "left") { // Left direction paths
        scheduleTimeout(() => {
            if(i+1 >= 0 && i+1 <= path[1].length-1) {
              if(path[1][i+1].direction === "up") {
                callbacks.onPathDirection(row, column, "left-to-up-path");
              }
              else if(path[1][i+1].direction === "down") {
                callbacks.onPathDirection(row, column, "left-to-down-path");
              }
              else {
                callbacks.onPathDirection(row, column, "horizontal-path");
              }
            }
          },
          timeDelay + ((path[1].length) * stepDelay)
        );
      }
      else if(path[1][i].direction === "right") { // Right direction paths
        scheduleTimeout(() => {
            if(i+1 >= 0 && i+1 <= path[1].length-1) {
              if(path[1][i+1].direction === "up") {
                callbacks.onPathDirection(row, column, "right-to-up-path");
              }
              else if(path[1][i+1].direction === "down") {
                callbacks.onPathDirection(row, column, "right-to-down-path");
              }
              else {
                callbacks.onPathDirection(row, column, "horizontal-path");
              }
            }
          },
          timeDelay + ((path[1].length) * stepDelay)
        );
      }
      else {
        continue;
      }
      timeDelay += stepDelay;
    }
  }
}

// A frontier that pops plain nodes (Stack for DFS, Queue for BFS) - no
// per-node priority/cost tracking.
type UnweightedFrontier = Stack<SearchNode> | Queue<SearchNode>;

// Computes the priority a child node should be pushed with, given the
// parent's own priority (its cumulative cost-so-far) and the goal.
type PriorityFn = (child: CoordinateAndDirection, parentPriority: number, goal: CoordinateAndDirection) => number;

/**
 * Shared frontier-exploration core behind all 5 pathfinding algorithms below.
 * BFS/DFS pass an unweighted Queue/Stack frontier and no priority function;
 * Dijkstra, A-star, and Greedy pass a PriorityQueueAscend frontier plus the
 * priority function that gives each of them their distinct search order.
 *
 * @param rows - total number of rows for the board
 * @param columns - total number of columns for the board
 * @param start - start coordinate
 * @param goal - goal coordinate
 * @param walls - set containing all the walls of the board
 * @param scheduleTimeout - schedules a timed animation step (caller owns cancellation)
 * @param callbacks - reports each visual change so the caller can drive board state
 * @param frontier - the frontier data structure driving exploration order
 * @param computePriority - priority function for a weighted frontier (omitted for BFS/DFS)
 * @param stepDelay - ms added to fillDelay per animated step (speed control)
 * @returns path from start coordinate to goal coordinate, or null if none exists
 */
function search(
  rows: number,
  columns: number,
  start: CoordinateAndDirection,
  goal: CoordinateAndDirection,
  walls: Set<string>,
  scheduleTimeout: ScheduleTimeout,
  callbacks: AnimationCallbacks,
  frontier: UnweightedFrontier | PriorityQueueAscend<SearchNode>,
  computePriority?: PriorityFn,
  stepDelay: number = 10
): CoordinateAndDirection[] | null {

  const path: CoordinateAndDirection[] = [];
  const visited = new Set<string>();
  let fillDelay = stepDelay;

  // if start state is the goal state
  if(checkStartIsGoal(start, goal)) {
    return path;
  }

  const isPriorityFrontier = frontier instanceof PriorityQueueAscend;

  // Add start state to the frontier
  if(isPriorityFrontier) {
    (frontier as PriorityQueueAscend<SearchNode>).push([start, path], 0);
  }
  else {
    (frontier as UnweightedFrontier).push([start, path]);
  }

  while (!frontier.isEmpty()) {
    // Pop the top of the frontier
    const popped = frontier.pop();

    if(popped) {
      const parent: SearchNode = isPriorityFrontier ? (popped as PriorityItem<SearchNode>).item : (popped as SearchNode);
      const parentPriority: number = isPriorityFrontier ? (popped as PriorityItem<SearchNode>).priority : 0;

      // If we are at the goal, return the path
      // Else, continue adding to the frontier, finding children moves, etc
      if (checkParentIsGoal(goal, parent)) {
        parent[1].push(goal);

        // Fill the goal path at the end
        showGoalPathLine(columns, parent, fillDelay, scheduleTimeout, callbacks, stepDelay);
        return parent[1];
      }
      else {
        // if parent position is a wall or is already visited, continue
        // Else, find children and add to frontier, add parent position to visited
        if(checkParentIsWall(walls, parent) || checkParentVisited(visited, parent)) {
          continue;
        }
        else {
          const children = findChildrenMoves(rows, columns, parent[0]);
          for (let i=0; i<children.length; i++) {
            const newPath = [...parent[1]];
            newPath.push(parent[0]);

            if(isPriorityFrontier && computePriority) {
              const priority = computePriority(children[i], parentPriority, goal);
              (frontier as PriorityQueueAscend<SearchNode>).push([children[i], newPath], priority);
            }
            else {
              (frontier as UnweightedFrontier).push([children[i], newPath]);
            }

            // if child position is not a wall, visited, or goal, color it in
            if(!checkChildVisited(visited, children[i]) && !checkChildIsWall(walls, children[i]) && !checkChildIsGoal(goal, children[i])) {
              const row = children[i].row;
              const column = children[i].column;
              scheduleTimeout(() => {
                  callbacks.onCellVisited(row, column);
                },
                fillDelay
              );
              fillDelay += stepDelay;
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
 * @param algoType - string indicating the type of unweighted algorithm
 * @param scheduleTimeout - schedules a timed animation step (caller owns cancellation)
 * @param callbacks - reports each visual change so the caller can drive board state
 * @param stepDelay - ms added to fillDelay per animated step (speed control)
 * @returns path from start coordinate to goal coordinate in an unweighted search
 */
function unweightedSearch(
  rows: number,
  columns: number,
  start: CoordinateAndDirection,
  goal: CoordinateAndDirection,
  walls: Set<string>,
  algoType: string,
  scheduleTimeout: ScheduleTimeout,
  callbacks: AnimationCallbacks,
  stepDelay: number = 10
): CoordinateAndDirection[] | null {
  // Breadth-first pops in the order pushed (FIFO); depth-first always pops
  // whatever was pushed most recently (LIFO) - see Queue/Stack in models.ts.
  // BFS/DFS are intentionally weight-blind (every step costs exactly 1,
  // regardless of any weighted terrain) - that's what makes them visibly
  // different from Dijkstra/A* on a weighted grid; only weightedSearch below
  // reads terrain weight.
  const frontier: UnweightedFrontier = algoType === "BreadthFirstSearch"
    ? new Queue<SearchNode>()
    : new Stack<SearchNode>();

  return search(rows, columns, start, goal, walls, scheduleTimeout, callbacks, frontier, undefined, stepDelay);
}

// Looks up a cell's traversal weight (defaults to 1, i.e. unweighted).
function getWeight(weights: Map<string, number>, coordinate: CoordinateAndDirection): number {
  return weights.get(coordinate.row + "_" + coordinate.column) ?? 1;
}

/**
 *
 * @param rows - total number of rows for the board
 * @param columns - total number of columns for the board
 * @param start - start coordinate
 * @param goal - goal coordinate
 * @param walls - set containing all the walls of the board
 * @param weights - map of coordinate key ("row_column") to traversal cost for weighted terrain (absent = 1)
 * @param algoType - string indicating the type of weighted algorithm
 * @param scheduleTimeout - schedules a timed animation step (caller owns cancellation)
 * @param callbacks - reports each visual change so the caller can drive board state
 * @param stepDelay - ms added to fillDelay per animated step (speed control)
 * @returns path from start coordinate to goal coordinate in an weighted search
 */
function weightedSearch(
  rows: number,
  columns: number,
  start: CoordinateAndDirection,
  goal: CoordinateAndDirection,
  walls: Set<string>,
  weights: Map<string, number>,
  algoType: string,
  scheduleTimeout: ScheduleTimeout,
  callbacks: AnimationCallbacks,
  stepDelay: number = 10
): CoordinateAndDirection[] | null {
  let computePriority: PriorityFn;

  if(algoType === "GreedyBestFirstSearch") {
    // Greedy only ever looks at distance-to-goal - the path taken to get
    // here (and so terrain weight, which is a path-cost concept) never
    // factors in. It's fast but not guaranteed shortest, and its chosen
    // path is unaffected by weighted terrain - that's the point of
    // contrasting it with Dijkstra/A* on the same weighted grid.
    computePriority = (child, _parentPriority, goal) => getEuclideanDistance(child, goal);
  }
  else if(algoType === "AStarAlgorithm") {
    // f = g + h: cost-so-far (now terrain-weighted) plus a straight-line
    // estimate of what's left. getEuclideanDistance must return true (not
    // squared) distance here - it can never overestimate the real
    // (Manhattan) grid distance, which is what keeps A* guaranteed to
    // return a shortest (lowest-cost) path even with weighted terrain.
    computePriority = (child, parentPriority, goal) => (parentPriority + getWeight(weights, child)) + getEuclideanDistance(child, goal);
  }
  else {
    // Dijkstra's Algorithm: pure cost-so-far (terrain-weighted), no heuristic.
    computePriority = (child, parentPriority) => parentPriority + getWeight(weights, child);
  }

  return search(rows, columns, start, goal, walls, scheduleTimeout, callbacks, new PriorityQueueAscend<SearchNode>(), computePriority, stepDelay);
}

export {
  unweightedSearch,
  weightedSearch
};
