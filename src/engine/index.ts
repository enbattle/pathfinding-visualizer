// Public API of the engine: pure TypeScript, no React/DOM. The UI layer
// imports from here only - see docs/architecture.md.
export { createGrid, toIndex, WEIGHTED_TERRAIN_COST, type Grid } from './grid';
export {
  PATH_ALGORITHMS,
  search,
  runSearch,
  type PathAlgorithmId,
  type PathAlgorithmInfo,
  type Optimality,
  type SearchProblem,
  type SearchEvent,
  type SearchResult,
} from './pathfinding';
export {
  MAZE_ALGORITHMS,
  generateMaze,
  type MazeAlgorithmId,
  type MazeAlgorithmInfo,
  type MazeProblem,
  type WallPlacement,
} from './mazes';
export { seededRandom, randomInt, type Random } from './random';
