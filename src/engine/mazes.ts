import { randomEvenInt, randomOddInt, type Random } from './random';

export type MazeAlgorithmId =
  'recursive-division' | 'recursive-division-thick' | 'prims';

export interface MazeAlgorithmInfo {
  readonly id: MazeAlgorithmId;
  readonly label: string;
}

/** Every maze algorithm, in the order the UI lists them. */
export const MAZE_ALGORITHMS: readonly MazeAlgorithmInfo[] = [
  { id: 'recursive-division', label: 'Recursive Division' },
  { id: 'recursive-division-thick', label: 'Twin Recursive Division' },
  { id: 'prims', label: "Prim's Algorithm" },
];

/** Board shape plus start/goal as flat indices (`row * columns + column`). */
export interface MazeProblem {
  readonly rows: number;
  readonly columns: number;
  readonly start: number;
  readonly goal: number;
}

/**
 * One animated wall placement. `tick` is the animation step it lands on
 * (playback advances ticks at the Player's rate); several placements can
 * share a tick, which is how independent parts of a maze animate in
 * parallel.
 */
export interface WallPlacement {
  readonly index: number;
  readonly tick: number;
}

interface Point {
  readonly row: number;
  readonly column: number;
}

// Records placements, keeping only each cell's earliest tick - a cell
// already walled stays walled, so any later placement of it is a no-op.
class PlacementLog {
  private readonly earliest = new Map<number, number>();

  constructor(private readonly columns: number) {}

  place(row: number, column: number, tick: number): void {
    const index = row * this.columns + column;
    const existing = this.earliest.get(index);
    if (existing === undefined || tick < existing) {
      this.earliest.set(index, tick);
    }
  }

  toPlacements(exclude: readonly number[]): WallPlacement[] {
    const placements: WallPlacement[] = [];
    for (const [index, tick] of this.earliest) {
      if (!exclude.includes(index)) placements.push({ index, tick });
    }
    // Array.prototype.sort is stable, so equal ticks keep insertion order.
    return placements.sort((a, b) => a.tick - b.tick);
  }
}

/**
 * Generates a maze as a list of timed wall placements: the outer border
 * plus the chosen algorithm's interior, both starting at tick 0 so they
 * animate in parallel. The result has one entry per walled cell (at its
 * earliest tick), sorted by tick, never walls `start` or `goal`, and
 * always leaves them connected - wherever they are, border and corners
 * included (see anchorRoute).
 *
 * `random` is injected so a maze is exactly reproducible from a seed
 * (see seededRandom in ./random).
 */
export function generateMaze(
  problem: MazeProblem,
  algorithm: MazeAlgorithmId,
  random: Random = Math.random
): WallPlacement[] {
  const { rows, columns } = problem;
  const start: Point = {
    row: Math.floor(problem.start / columns),
    column: problem.start % columns,
  };
  const goal: Point = {
    row: Math.floor(problem.goal / columns),
    column: problem.goal % columns,
  };
  // Too thin for an interior: every cell is border, so any maze would wall
  // start off from goal.
  if (rows < 3 || columns < 3) return [];

  const log = new PlacementLog(columns);
  const interior = { y: 1, x: 1, maxY: rows - 2, maxX: columns - 2 };
  const startRoute = anchorRoute(start, rows, columns);
  const goalRoute = anchorRoute(goal, rows, columns);
  const keepOpen = [...startRoute.route, ...goalRoute.route];

  drawBorderWalls(log, keepOpen, rows, columns);
  // The interior algorithms protect (and connect) the interior end of each
  // route, which is start/goal itself unless it sits on the border.
  if (algorithm === 'prims') {
    prims(log, random, startRoute.inner, goalRoute.inner, interior);
  } else {
    const thickness = algorithm === 'recursive-division-thick' ? 2 : 1;
    buildDividingWalls(
      log,
      random,
      thickness,
      0,
      startRoute.inner,
      goalRoute.inner,
      interior
    );
  }

  return log.toPlacements(
    keepOpen.map(({ row, column }) => row * columns + column)
  );
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * The interior algorithms guarantee connectivity for anchors *inside* the
 * border - but start/goal can be dragged or shared onto the border itself,
 * where the border walls (and Prim's lattice parity) would seal it off.
 * So each anchor is routed to its nearest interior cell: `route` is the
 * anchor plus the at most two cells stepping straight to `inner` (row
 * first, then column - a corner needs both), all kept open; `inner` is
 * what the interior algorithm then protects. For an interior anchor the
 * route is just the anchor, so those mazes are unchanged.
 */
function anchorRoute(
  anchor: Point,
  rows: number,
  columns: number
): { inner: Point; route: Point[] } {
  const inner: Point = {
    row: clamp(anchor.row, 1, rows - 2),
    column: clamp(anchor.column, 1, columns - 2),
  };
  const route: Point[] = [anchor];
  if (anchor.row !== inner.row && anchor.column !== inner.column) {
    route.push({ row: inner.row, column: anchor.column });
  }
  if (!isAt(anchor, inner.row, inner.column)) route.push(inner);
  return { inner, route };
}

const isAt = (point: Point, row: number, column: number): boolean =>
  point.row === row && point.column === column;

// Walks the border clockwise from the top-left corner (down the left edge,
// along the bottom, up the right, back along the top), one cell per tick.
// Cells on a start/goal route stay open; the tick advances past them
// anyway, so the animation keeps a steady pace around the perimeter.
function drawBorderWalls(
  log: PlacementLog,
  keepOpen: readonly Point[],
  rows: number,
  columns: number
): void {
  let tick = 0;
  const visit = (row: number, column: number): void => {
    if (!keepOpen.some(point => isAt(point, row, column))) {
      log.place(row, column, tick);
    }
    tick += 1;
  };

  for (let i = 0; i < rows; i++) visit(i, 0);
  for (let i = 0; i < columns; i++) visit(rows - 1, i);
  for (let i = rows - 1; i >= 0; i--) visit(i, columns - 1);
  for (let i = columns - 1; i >= 0; i--) visit(0, i);
}

// If the area is wider (left to right), cut it with a vertical wall; if
// it's taller, a horizontal one; a square area picks at random. Only the
// square case consumes a random number.
function isHorizontalCut(
  random: Random,
  width: number,
  height: number
): boolean {
  if (width > height) return false;
  if (width < height) return true;
  return random() < 0.5;
}

interface Region {
  readonly y: number;
  readonly x: number;
  readonly maxY: number;
  readonly maxX: number;
}

/**
 * Recursive division: lays a wall of `thickness` cells across the shorter
 * dimension of `region` (with a single-cell opening) and recurses into the
 * two halves left behind, until a region is too small to keep dividing.
 * Both halves continue from the same tick, so sibling regions animate in
 * parallel.
 *
 * Each wall normally leaves exactly one opening, which is what keeps the
 * maze fully connected. The deliberate exception is the start/goal
 * exclusion below.
 */
function buildDividingWalls(
  log: PlacementLog,
  random: Random,
  thickness: number,
  startTick: number,
  start: Point,
  goal: Point,
  { y, x, maxY, maxX }: Region
): void {
  // A wall this thick needs this much room on either side of it before the
  // next partition can start - below that, stop dividing this partition.
  const partitionOffset = 2 * thickness - 1;
  if (maxX - x < partitionOffset || maxY - y < partitionOffset) return;

  const horizontal = isHorizontalCut(random, maxX - x, maxY - y);

  // Is `position` within the safety buffer around a wall starting at
  // `wallStart`? Cells here are skipped when laying the wall so start/goal
  // never end up boxed in directly against it.
  const inSafetyBuffer = (position: number, wallStart: number) =>
    Math.abs(position - wallStart) <= thickness;

  // True when start/goal's own row (or column, for vertical walls) falls
  // *inside* the wall's thickness-span rather than merely being adjacent to
  // it - i.e. the wall would otherwise run directly through the cell
  // start/goal sits on. A single-cell opening at its own column (row) isn't
  // enough in that case: the cells immediately beside it *in that same wall
  // line* are still walled, which seals off its only remaining access
  // along the line. Widening the exclusion to those neighbors too is what
  // guarantees start/goal always keeps at least one open side.
  const isEmbeddedInWall = (position: number, wallStart: number) =>
    position >= wallStart && position < wallStart + thickness;

  // Would walling `along` (the position along the wall line) trap `anchor`?
  // `across` picks the anchor's coordinate perpendicular to the wall line.
  const wouldTrap = (
    anchorAcross: number,
    anchorAlong: number,
    wallStart: number,
    along: number
  ): boolean =>
    inSafetyBuffer(anchorAcross, wallStart) &&
    (isEmbeddedInWall(anchorAcross, wallStart)
      ? Math.abs(along - anchorAlong) <= 1
      : along === anchorAlong);

  let tick = startTick;

  if (horizontal) {
    // Wall on an even row, opening on an odd column.
    const wallY = randomEvenInt(random, y, maxY);
    const openingX = randomOddInt(random, x, maxX);

    for (let i = x; i <= maxX; i++) {
      if (
        i !== openingX &&
        !wouldTrap(start.row, start.column, wallY, i) &&
        !wouldTrap(goal.row, goal.column, wallY, i)
      ) {
        for (let layer = 0; layer < thickness; layer++) {
          log.place(wallY + layer, i, tick);
        }
        tick += 1;
      }
    }

    buildDividingWalls(log, random, thickness, tick, start, goal, {
      y,
      x,
      maxY: wallY - partitionOffset,
      maxX,
    });
    buildDividingWalls(log, random, thickness, tick, start, goal, {
      y: wallY + partitionOffset,
      x,
      maxY,
      maxX,
    });
  } else {
    // Wall on an even column, opening on an odd row.
    const wallX = randomEvenInt(random, x, maxX);
    const openingY = randomOddInt(random, y, maxY);

    for (let i = y; i <= maxY; i++) {
      if (
        i !== openingY &&
        !wouldTrap(start.column, start.row, wallX, i) &&
        !wouldTrap(goal.column, goal.row, wallX, i)
      ) {
        for (let layer = 0; layer < thickness; layer++) {
          log.place(i, wallX + layer, tick);
        }
        tick += 1;
      }
    }

    buildDividingWalls(log, random, thickness, tick, start, goal, {
      y,
      x,
      maxY,
      maxX: wallX - partitionOffset,
    });
    buildDividingWalls(log, random, thickness, tick, start, goal, {
      y,
      x: wallX + partitionOffset,
      maxY,
      maxX,
    });
  }
}

/**
 * Randomized Prim's algorithm - grows a random spanning tree over a
 * "chamber" lattice (every 2nd cell in each dimension, relative to the
 * region's top-left corner) rather than carving every individual cell, so
 * the result reads as a proper maze (walls remain between passages)
 * instead of an all-open board - a structurally different, organic/
 * branching look versus Recursive Division's blocky partitions.
 *
 * Connectivity is guaranteed by construction, not by chance: start and
 * goal are each explicitly wired into the lattice via a short carved
 * connector (needed since they won't generally land exactly on a chamber
 * cell), and the chamber lattice itself is always fully connected - a
 * spanning tree grown from one chamber always reaches every other chamber,
 * since the underlying chamber grid is itself fully connected via
 * cardinal adjacency. So start and goal are always mutually reachable
 * through (their own connector) -> (the spanning tree) -> (the other's
 * connector).
 *
 * Walls are then placed one per tick over every uncarved region cell, in
 * row-major order.
 */
function prims(
  log: PlacementLog,
  random: Random,
  start: Point,
  goal: Point,
  { y, x, maxY, maxX }: Region
): void {
  // Carved-open cells, indexed relative to the region's top-left corner.
  const width = maxX - x + 1;
  const height = maxY - y + 1;
  if (width <= 0 || height <= 0) return;
  const carved = new Uint8Array(width * height);
  const carve = (row: number, column: number): void => {
    // Start/goal can sit outside the region (e.g. dragged onto the border);
    // their connector cells then aren't region cells and need no carving.
    if (row >= y && row <= maxY && column >= x && column <= maxX) {
      carved[(row - y) * width + (column - x)] = 1;
    }
  };

  // Carves a short straight connector from an arbitrary cell to the
  // nearest chamber cell (fixing row parity, then column parity, one step
  // at a time) so start/goal always end up wired into the lattice even
  // when they don't land on a chamber cell themselves.
  const connectToLattice = ({ row, column }: Point): void => {
    let r = row;
    let c = column;
    carve(r, c);
    if ((r - y) % 2 !== 0) {
      r = r + 1 <= maxY ? r + 1 : r - 1;
      carve(r, c);
    }
    if ((c - x) % 2 !== 0) {
      c = c + 1 <= maxX ? c + 1 : c - 1;
      carve(r, c);
    }
  };

  connectToLattice(start);
  connectToLattice(goal);

  const chamberRows: number[] = [];
  for (let r = y; r <= maxY; r += 2) chamberRows.push(r);
  const chamberColumns: number[] = [];
  for (let c = x; c <= maxX; c += 2) chamberColumns.push(c);

  const visited = new Uint8Array(width * height);
  const isVisited = (row: number, column: number): boolean =>
    visited[(row - y) * width + (column - x)] === 1;

  // Each frontier entry is a not-yet-visited chamber, and the
  // already-visited chamber it would be carved in from.
  const frontier: {
    row: number;
    column: number;
    fromRow: number;
    fromColumn: number;
  }[] = [];

  const addFrontier = (row: number, column: number): void => {
    const candidates: [number, number][] = [
      [row - 2, column],
      [row + 2, column],
      [row, column - 2],
      [row, column + 2],
    ];
    for (const [nr, nc] of candidates) {
      if (
        nr >= y &&
        nr <= maxY &&
        nc >= x &&
        nc <= maxX &&
        !isVisited(nr, nc)
      ) {
        frontier.push({
          row: nr,
          column: nc,
          fromRow: row,
          fromColumn: column,
        });
      }
    }
  };

  const firstRow = chamberRows[Math.floor(random() * chamberRows.length)];
  const firstColumn =
    chamberColumns[Math.floor(random() * chamberColumns.length)];
  visited[(firstRow - y) * width + (firstColumn - x)] = 1;
  carve(firstRow, firstColumn);
  addFrontier(firstRow, firstColumn);

  while (frontier.length > 0) {
    const pick = Math.floor(random() * frontier.length);
    const { row, column, fromRow, fromColumn } = frontier[pick];
    frontier.splice(pick, 1);
    if (isVisited(row, column)) continue;

    visited[(row - y) * width + (column - x)] = 1;
    carve(row, column);
    // The connector cell sits exactly between the chamber being carved
    // in and the already-visited chamber it's being carved in from.
    carve((row + fromRow) / 2, (column + fromColumn) / 2);
    addFrontier(row, column);
  }

  // Every region cell that never got carved open is a wall.
  let tick = 0;
  for (let r = y; r <= maxY; r++) {
    for (let c = x; c <= maxX; c++) {
      if (
        carved[(r - y) * width + (c - x)] === 0 &&
        !isAt(start, r, c) &&
        !isAt(goal, r, c)
      ) {
        log.place(r, c, tick);
        tick += 1;
      }
    }
  }
}
