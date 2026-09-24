/**
 * The cells on a straight line from `from` to `to` (both flat indices on a
 * board `columns` wide), excluding `from` and including `to`, stepping
 * through edge-adjacent cells only (no diagonal jumps).
 *
 * Pointer events arrive at most once per frame, so a fast drag can jump
 * several cells between two events; painting just the endpoints would
 * leave gaps in the wall. This fills them in, like a pen stroke.
 */
export function cellsBetween(
  from: number,
  to: number,
  columns: number
): number[] {
  let row = Math.floor(from / columns);
  let column = from % columns;
  const toRow = Math.floor(to / columns);
  const toColumn = to % columns;
  const rowStep = Math.sign(toRow - row);
  const columnStep = Math.sign(toColumn - column);
  const rowDistance = Math.abs(toRow - row);
  const columnDistance = Math.abs(toColumn - column);

  // Bresenham-style error term, taking one axis step at a time so
  // consecutive cells always share an edge.
  let error = columnDistance - rowDistance;
  const cells: number[] = [];
  while (row !== toRow || column !== toColumn) {
    if (error > 0 || (error === 0 && columnDistance >= rowDistance)) {
      column += columnStep;
      error -= 2 * rowDistance;
    } else {
      row += rowStep;
      error += 2 * columnDistance;
    }
    cells.push(row * columns + column);
  }
  return cells;
}
