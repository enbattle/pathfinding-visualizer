// Which line-segment CSS class (index.css: vertical-path, left-to-up-path,
// ...) draws the final path through each of its interior cells. A cell's
// segment depends on the direction the path enters it and the direction
// it leaves it.

export type PathSegmentClass =
  | 'vertical-path'
  | 'horizontal-path'
  | 'left-to-up-path'
  | 'left-to-down-path'
  | 'right-to-up-path'
  | 'right-to-down-path';

type Move = 'up' | 'down' | 'left' | 'right';

function moveBetween(from: number, to: number, columns: number): Move {
  if (to === from - columns) return 'up';
  if (to === from + columns) return 'down';
  if (to === from - 1) return 'left';
  if (to === from + 1) return 'right';
  throw new Error(`cells ${from} and ${to} are not neighbors`);
}

// SEGMENT[enter][leave]. The class names describe the drawn corner shape
// (index.css), not the travel direction - e.g. entering upward and turning
// left draws the "right-to-down" corner.
const SEGMENT: Record<Move, Partial<Record<Move, PathSegmentClass>>> = {
  up: { left: 'right-to-down-path', right: 'left-to-down-path' },
  down: { left: 'right-to-up-path', right: 'left-to-up-path' },
  left: { up: 'left-to-up-path', down: 'left-to-down-path' },
  right: { up: 'right-to-up-path', down: 'right-to-down-path' },
};

/**
 * For a path of cell indices (start first, goal last), returns the segment
 * class for each *interior* cell - i.e. `result[i]` belongs to
 * `path[i + 1]`. Start and goal get markers instead of segments.
 */
export function pathSegmentClasses(
  path: readonly number[],
  columns: number
): PathSegmentClass[] {
  const result: PathSegmentClass[] = [];
  for (let i = 1; i < path.length - 1; i++) {
    const enter = moveBetween(path[i - 1], path[i], columns);
    const leave = moveBetween(path[i], path[i + 1], columns);
    const straight =
      enter === 'up' || enter === 'down' ? 'vertical-path' : 'horizontal-path';
    result.push(SEGMENT[enter][leave] ?? straight);
  }
  return result;
}
