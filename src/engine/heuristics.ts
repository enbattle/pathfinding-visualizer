import type { Grid } from './grid';

/** Estimates the remaining cost from cell `from` to cell `to`. */
export type Heuristic = (
  grid: Pick<Grid, 'columns'>,
  from: number,
  to: number
) => number;

/**
 * |dRow| + |dColumn|. On a 4-connected grid where every step costs at
 * least 1, this never overestimates the real remaining cost (admissible)
 * and never drops by more than one step's cost per step (consistent) - the
 * two properties A* needs to return a lowest-cost path. It's also never
 * smaller than straight-line distance, so it guides A* more tightly and
 * A* expands fewer cells with it.
 */
export const manhattan: Heuristic = (grid, from, to) => {
  const { columns } = grid;
  const dRow = Math.abs(Math.floor(from / columns) - Math.floor(to / columns));
  const dColumn = Math.abs((from % columns) - (to % columns));
  return dRow + dColumn;
};

/**
 * Straight-line distance. Also admissible on this grid, but looser than
 * Manhattan; kept for Greedy Best-first, where its preference for heading
 * straight at the goal gives a more natural-looking beeline than
 * Manhattan's many ties.
 */
export const euclidean: Heuristic = (grid, from, to) => {
  const { columns } = grid;
  const dRow = Math.floor(from / columns) - Math.floor(to / columns);
  const dColumn = (from % columns) - (to % columns);
  return Math.sqrt(dRow * dRow + dColumn * dColumn);
};
