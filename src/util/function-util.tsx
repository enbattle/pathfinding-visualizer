import { CoordinateAndDirection } from "../models/models";

/**
 * 
 * @param max - maximum random value that can be returned
 * @returns random value between 0 and max
 */
function randIntUpTo(max: number) {
  return Math.floor(Math.random() * max);
}

/**
 * 
 * @param min - minimum random value that can be returned
 * @param max - maximum random value that can be returned
 * @returns random value between min (included) and max (included)
 */
function randIntBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * 
 * @param min - minimum interval value
 * @param max - maximum interval value
 * @returns even integer between the min (included) and max (included), -1 is returned if min equals max and it's an odd number
 */
function evenRandIntBetween(min: number, max: number) {
  if(min === max && min%2 !== 0) {
    return -1;
  }
  else if(min === max) {
    return min;
  }

  const newMin = min%2 !== 0 ? min+1 : min;
  return newMin + 2 * randIntBetween(0, Math.floor((max-newMin) / 2));
}

/**
 * 
 * @param min - minimum interval value
 * @param max - maximum interval value
 * @returns odd integer between the min (included) and max (included), -1 is returned if min equals max and it's an even number
 */
function oddRandIntBetween(min: number, max: number) {
  if(min === max && min%2 === 0) {
    return -1;
  }
  else if(min === max) {
    return min;
  }

  const newMin = min%2 === 0 ? min+1 : min;
  return newMin + 2 * randIntBetween(0, Math.floor((max-newMin) / 2));
}

/**
 * 
 * @param {*} current - current CoordinateAndDirection (has a row and column property to define position)
 * @param {*} end  = goal CoordinateAndDirection (has a row and column property to define position)
 * @returns Manhattan distance between the coordinates
 */
function getManhattanDistance(current: CoordinateAndDirection, end: CoordinateAndDirection) {
  return Math.abs(current.row - end.row) + Math.abs(current.column - end.column);
}

/**
 * 
 * @param {*} current - current CoordinateAndDirection (has a row and column property to define position)
 * @param {*} end  = goal CoordinateAndDirection (has a row and column property to define position)
 * @returns Euclidean distance between the coordinates 
 */
function getEuclideanDistance(current: CoordinateAndDirection, end: CoordinateAndDirection) {
  return Math.pow(current.column - end.column, 2) + Math.pow(current.row - end.row, 2);
}

export {
  randIntUpTo,
  randIntBetween,
  evenRandIntBetween,
  oddRandIntBetween,
  getManhattanDistance,
  getEuclideanDistance
};