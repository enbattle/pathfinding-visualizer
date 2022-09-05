import { PriorityQueueAscend } from './structure-util';

interface CoordinateAndDirection {
	row: number;
	column: number;
	direction: string;
}

/**
 * 
 * @param {*} current - current CoordinateAndDirection (has a row and column property to define position)
 * @param {*} end  = goal CoordinateAndDirection (has a row and column property to define position)
 * @returns absolute distance between the 
 */
function getManhattanDistance(current: CoordinateAndDirection, end: CoordinateAndDirection) {
  return Math.abs(current.row - end.row) + Math.abs(current.column - end.column);
}

/* 
  Find the next possible moves given a certain position.

    - rows: Integer value of rows in the maze
    - columns: Integer value of columns in the maze
    - currentPosition: Current position as an object with properties (row, column)
*/
function findChildrenMoves(rows: number, columns: number, currentPosition: { row: number, column: number }) {
  let childrenPositions: CoordinateAndDirection[] = [];

  // Top move
  if (currentPosition.row-1 >= 0) {
    let children = {
      row: currentPosition.row-1,
      column: currentPosition.column,
      direction: "up"
    }
    childrenPositions.push(children);
  }
    
  // Right move
  if (currentPosition.column+1 <= columns-1) {
    let children = {
      row: currentPosition.row,
      column: currentPosition.column+1,
      direction: "right"
    }
    childrenPositions.push(children);
  }
    
  // Down move
  if (currentPosition.row+1 <= rows-1) {
    let children = {
      row: currentPosition.row+1,
      column: currentPosition.column,
      direction: "down"
    }
    childrenPositions.push(children);
  }
    
  // Left move
  if (currentPosition.column-1 >= 0) {
    let children = {
      row: currentPosition.row,
      column: currentPosition.column-1,
      direction: "left"
    }
    childrenPositions.push(children);
  }
  return childrenPositions;
}

function showEndPathLine(path: [CoordinateAndDirection, CoordinateAndDirection[]], fillDelay: number, setShowEndPath: (showPath: boolean) => void) {
  let timeDelay = fillDelay;

  // Fill in the goal path at the end
  for (let i=0; i<path[1].length; i++) {
    if (i === 0 || i === path[1].length-1) {
      continue;
    }
    else {
      setTimeout(
        function() {
          if (document?.getElementById(path[1][i].row + "_" + path[1][i].column)?.className) {
            document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " end-path-fill";
          }
        },
        timeDelay
      );

      if (i+1 === path[1].length-1) {
        if (path[1][i].row > path[1][i+1].row) {
          path[1][i+1].direction = "up";
        }
        else if (path[1][i].row < path[1][i+1].row) {
          path[1][i+1].direction = "down";
        }
        else if (path[1][i].column > path[1][i+1].column) {
          path[1][i+1].direction = "left";
        }
        else if (path[1][i].column < path[1][i+1].column) {
          path[1][i+1].direction = "right";
        }
      }

      if (path[1][i].direction === "up") {
        setTimeout(
          function() {
            if (document?.getElementById(path[1][i].row + "_" + path[1][i].column)) {
              setShowEndPath(true);

              if (i+1 >= 0 && i+1 <= path[1].length-1) {
                if (path[1][i+1].direction === "left") {
                  document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " right-to-down-path";
                }
                else if (path[1][i+1].direction === "right") {
                  document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " left-to-down-path";
                }
                else {
                  document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " vertical-path";
                }
              }
            }
          },
          timeDelay + ((path[1].length) * 10)
        )	
      }
      else if (path[1][i].direction === "down") {
        setTimeout(
          function() {
            if (document?.getElementById(path[1][i].row + "_" + path[1][i].column)) {
              setShowEndPath(true);

              console.log(i, 0, path[1].length);

              if (i+1 >= 0 && i+1 <= path[1].length-1) {
                if (path[1][i+1].direction === "left") {
                  document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " right-to-up-path";
                }
                else if (path[1][i+1].direction === "right") {
                  document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " left-to-up-path";
                }
                else {
                  document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " vertical-path";
                }
              }
            }
          },
          timeDelay + ((path[1].length) * 10)
        )	
      }
      else if (path[1][i].direction === "left") {
        setTimeout(
          function() {
            if (document?.getElementById(path[1][i].row + "_" + path[1][i].column)) {
              setShowEndPath(true);

              if (i+1 >= 0 && i+1 <= path[1].length-1) {
                if (path[1][i+1].direction === "up") {
                  document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " left-to-up-path";
                }
                else if (path[1][i+1].direction === "down") {
                  document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " left-to-down-path";
                }
                else {
                  document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " horizontal-path";
                }
              }
            }
          },
          timeDelay + ((path[1].length) * 10)
        )	
      }
      else if (path[1][i].direction === "right") {
        setTimeout(
          function() {
            if (document?.getElementById(path[1][i].row + "_" + path[1][i].column)) {
              setShowEndPath(true);

              if (i+1 >= 0 && i+1 <= path[1].length-1) {
                if (path[1][i+1].direction === "up") {
                  document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " right-to-up-path";
                }
                else if (path[1][i+1].direction === "down") {
                  document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " right-to-down-path";
                }
                else {
                  document!.getElementById(path[1][i].row + "_" + path[1][i].column)!.className += " horizontal-path";
                }
              }
            }
          },
          timeDelay + ((path[1].length) * 10)
        )	
      }
      else {
        continue;
      }
      timeDelay += 10;
    }
  }
}

function checkParentWallVisitedGoal(walls: Set<string>, visited: Set<string>, parent: [CoordinateAndDirection, CoordinateAndDirection[]]) {
  let foundVisited = false;
  let foundWall = false;

  // Check that the current position is not a wall
  if (walls.has(parent[0].row.toString() + "_" + parent[0].column.toString())) {
    foundWall = true;
  }

  // Check that the position has not been already visited
  if (visited.has(parent[0].row.toString() + "_" + parent[0].column.toString())) {
    foundVisited = true;
  }

  return foundWall || foundVisited;
}

function checkChildWallVisitedGoal(i: number, fillDelay: number, end: CoordinateAndDirection, walls: Set<string>, visited: Set<string>, children: CoordinateAndDirection[]) {
  let childWall = false;
  let childVisited = false;
  let childGoal = false;

  // Check that the child position is not a wall
  if (walls.has(children[i].row.toString() + "_" + children[i].column.toString())) {
    childWall = true;
  }

  // Check that the child position has not been already visited
  if (visited.has(children[i].row.toString() + "_" + children[i].column.toString())) {
    childVisited = true;
  }

  // Check that the child position is not the goal state
  if (children[i].row === end.row && children[i].column === end.column) {
    childGoal = true;
  }

  return !childWall && !childVisited && !childGoal;
}


/* 
  Breadth-first or Depth-first Search Algorithm

    - rows: Integer value of number of rows
    - columns: Integer value of number of columns
    - start: Start State as an object with row and column
    - end: Goal State as an object with row and column
    - walls: Set containing the wall positions chosen by the user as objects with 
      properties (row, column)
    - algoType: String that indicates breadth-first or depth-first
*/
function breadthAndDepthFirstSearch(rows: number, columns: number, start: CoordinateAndDirection, end: CoordinateAndDirection, walls: Set<string>, algoType: string, setShowEndPath: (showPath: boolean) => void) {
  let queue: [CoordinateAndDirection, CoordinateAndDirection[]][] = [];
  let path: CoordinateAndDirection[] = [];
  let visited = new Set<string>();
  let fillDelay = 10;

  // // If start state is the goal state
  // if (start.row === end.row && start.column === end.column) {
  // 	return path;
  // }
  
  // Add start state to the queue
  queue.push([start, path]);

  while (queue.length) {
    // Pop the top of the queue
    let parent = queue.shift();

    if(parent) {
      // If we are at the end, return the path
      // Else, continue adding to the queue, finding children moves, etc
      if (parent[0].row === end.row && parent[0].column === end.column) {
        parent[1].push(end);

        // Fill the goal path at the end
        showEndPathLine(parent, fillDelay, setShowEndPath);
        return parent[1];
      }
      else {
        // If current position is a wall or is already visited, continue
        // Else, find children and add to queue, add curren position to visited
        if(checkParentWallVisitedGoal(walls, visited, parent)) {
          continue;
        }
        else {
          let children = findChildrenMoves(rows, columns, parent[0]);
          for (let i=0; i<children.length; i++) {
            let newPath = JSON.parse(JSON.stringify(parent[1]));
            newPath.push(parent[0]);

            // Check if breath-first or depth-first
            if (algoType === "BreadthFirstSearch") {
              queue.push([children[i], newPath]);
            }
            else {
              queue.unshift([children[i], newPath]);
            }

            // If child position is not a wall, visited, or goal, color it in
            if (checkChildWallVisitedGoal(i, fillDelay, end, walls, visited, children)) {
              setTimeout(
                function() {
                  if(document?.getElementById(children[i].row.toString() + "_" + children[i].column.toString()))
                  document!.getElementById(children[i].row.toString() + "_" + children[i].column.toString())!.className += " board-fill";
                },
                fillDelay
              );
              fillDelay += 10;
            }
          }

          // Add current position to visited
          visited.add(parent[0].row.toString() + "_" + parent[0].column.toString());
        }
      }
    }
  }

  // If we reach here, it means that there are no possible paths to the goal
  return null;
}

/* 
  Uniform-Cost Search Algorithm

    - rows: Integer value of number of rows
    - columns: Integer value of number of columns
    - start: Start State as an object with row and column
    - end: Goal State as an object with row and column
    - walls: Set containing the wall positions chosen by the user as objects with 
      properties (row, column)
*/
function uniformCostSearch(rows: number, columns: number, start: CoordinateAndDirection, end: CoordinateAndDirection, walls: Set<string>, setShowEndPath: (showPath: boolean) => void) {
  let queue = new PriorityQueueAscend();
  let path: CoordinateAndDirection[] = [];
  let visited = new Set<string>();
  let fillDelay = 10;

  // // If start state is the goal state
  // if (start.row === end.row && start.column === end.column) {
  // 	return path;
  // }
  
  // Add start state to the queue
  queue.push([start, path], 0);

  while (!queue.isEmpty()) {
    // Pop the top of the queue
    let parent = queue.pop();

    if(parent) {
      // If we are at the end, return the path
      // Else, continue adding to the queue, finding children moves, etc
      if (parent.item[0].row === end.row && parent.item[0].column === end.column) {
        parent.item[1].push(end);

        // Fill in the goal path at the end
        showEndPathLine(parent.item, fillDelay, setShowEndPath);
        return parent.item[1];
      }
      else {
        // If current position is a wall or is already visited, continue
        // Else, find children and add to queue, add curren position to visited
        if(checkParentWallVisitedGoal(walls, visited, parent.item)) {
          continue;
        }
        else {
          let children = findChildrenMoves(rows, columns, parent?.item[0]);
          for (let i=0; i<children.length; i++) {
            let newPath = JSON.parse(JSON.stringify(parent?.item[1]));
            newPath.push(parent?.item[0]);

            queue.push([children[i], newPath], parent?.priority + 1);

            // If child position is not a wall, visited, or goal, color it in
            if (checkChildWallVisitedGoal(i, fillDelay, end, walls, visited, children)) {
              setTimeout(
                function() {
                  if (document?.getElementById(children[i].row.toString() + "_" + children[i].column.toString())) {
                    document!.getElementById(children[i].row.toString() + "_" + children[i].column.toString())!.className += " board-fill";
                  }
                },
                fillDelay
              );
              fillDelay += 10;
            }
          }

          // Add current position to visited
          visited.add(parent?.item[0].row.toString() + "_" + parent?.item[0].column.toString());
        }
      }
    }
  }

  // If we reach here, it means that there are no possible paths to the goal
  return null;
}

function aStarAlgorithmSearch(rows: number, columns: number, start: CoordinateAndDirection, end: CoordinateAndDirection, walls: Set<string>, setShowEndPath: (showPath: boolean) => void) {
  let queue = new PriorityQueueAscend();
  let path: CoordinateAndDirection[] = [];
  let visited = new Set<string>();
  let fillDelay = 10;

  // // If start state is the goal state
  // if (start.row === end.row && start.column === end.column) {
  // 	return path;
  // }

  // Add start state to the queue
  queue.push([start, path], 0);

  while (!queue.isEmpty()) {
    // Pop the top of the queue
    let parent = queue.pop();

    if(parent) {
      // If we are at the end, return the path
      // Else, continue adding to the queue, finding children moves, etc
      if (parent?.item[0].row === end.row && parent?.item[0].column === end.column) {
        parent?.item[1].push(end);

        // Fill in the goal path at the end
        showEndPathLine(parent.item, fillDelay, setShowEndPath);
        return parent?.item[1];
      }
      else {
        // If current position is a wall or is already visited, continue
        // Else, find children and add to queue, add curren position to visited
        if(checkParentWallVisitedGoal(walls, visited, parent.item)) {
          continue;
        }
        else {
          let children = findChildrenMoves(rows, columns, parent?.item[0]);
          for (let i=0; i<children.length; i++) {
            let newPath = JSON.parse(JSON.stringify(parent?.item[1]));
            newPath.push(parent?.item[0]);

            let g = parent?.priority + 1;
            let h = getManhattanDistance(children[i], end);
            let f = g + h;

            queue.push([children[i], newPath], f);


            // If child position is not a wall, visited, or goal, color it in
            if (checkChildWallVisitedGoal(i, fillDelay, end, walls, visited, children)) {
              setTimeout(
                function() {
                  if (document?.getElementById(children[i].row.toString() + "_" + children[i].column.toString())) {
                    document!.getElementById(children[i].row.toString() + "_" + children[i].column.toString())!.className += " board-fill";
                  }
                },
                fillDelay
              );
              fillDelay += 10;
            }
          }

          // Add current position to visited
          visited.add(parent?.item[0].row.toString() + "_" + parent?.item[0].column.toString());
        }
      }
    }
  }

  // If we reach here, it means that there are no possible paths to the goal
  return null;
}

export {
  breadthAndDepthFirstSearch,
  uniformCostSearch,
  aStarAlgorithmSearch
};