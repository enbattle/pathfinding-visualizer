import React from 'react';
import { weightedSearch, unweightedSearch } from '../algorithms/paths';
import {
  drawBorderWalls,
  recursiveDivision,
  recursiveDivisionTwoLayers,
  prims,
} from '../algorithms/walls';
import type { CoordinateAndDirection } from '../models/models';
import { cn } from '@/lib/utils';

export interface RunStats {
  visitedCount: number;
  pathLength: number | null;
  algorithmTimeMs: number;
}

interface IBoardParameters {
  rows: number;
  columns: number;
  startCoordinate: CoordinateAndDirection;
  goalCoordinate: CoordinateAndDirection;
  pathAlgorithm: string;
  wallAlgorithm: string;
  paintMode: 'wall' | 'weight';
  stepDelay: number;
  shouldBuildWalls: boolean;
  setShouldBuildWalls: (buildWallsState: boolean) => void;
  shouldVisualizePathAlgorithm: boolean;
  setShouldVisualizePathAlgorithm: (visualizeState: boolean) => void;
  shouldResetBoard: boolean;
  setShouldResetBoard: (resetState: boolean) => void;
  shouldResetPath: boolean;
  setShouldResetPath: (resetState: boolean) => void;
  onError: (message: string | null) => void;
  onStats: (stats: RunStats | null) => void;
}

type CellKind = 'empty' | 'wall' | 'weight' | 'start' | 'goal';

// Fixed extra traversal cost for a weighted-terrain cell (on top of the
// baseline cost of 1 every cell has).
const WEIGHT_VALUE = 5;

// Full visual state for a single cell. `kind` is mutually exclusive
// (a cell is exactly one of empty/wall/weight/start/goal); visited/pathFill/
// pathDirectionClass are independent overlays the search animation adds
// on top - a cell that was visited during search AND ends up on the final
// path carries all three at once, mirroring the original's additive
// className behavior (see paths.tsx's AnimationCallbacks).
interface CellState {
  kind: CellKind;
  visited: boolean;
  pathFill: boolean;
  pathDirectionClass: string | null;
}

function buildInitialCells(
  rows: number,
  columns: number,
  startCoordinate: CoordinateAndDirection,
  goalCoordinate: CoordinateAndDirection
): CellState[][] {
  const cells: CellState[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: CellState[] = [];
    for (let j = 0; j < columns; j++) {
      let kind: CellKind = 'empty';
      if (i === startCoordinate.row && j === startCoordinate.column) {
        kind = 'start';
      } else if (i === goalCoordinate.row && j === goalCoordinate.column) {
        kind = 'goal';
      }
      row.push({
        kind,
        visited: false,
        pathFill: false,
        pathDirectionClass: null,
      });
    }
    cells.push(row);
  }
  return cells;
}

function getCellClassName(cell: CellState): string {
  const classes: string[] = ['board-cell'];

  if (cell.kind === 'start' || cell.kind === 'goal') {
    classes.push('board-cell-anchor', 'text-center');
  }
  if (cell.kind === 'wall') {
    classes.push('wall-fill');
  }
  if (cell.kind === 'weight') {
    classes.push('weight-fill');
  }
  if (cell.visited) {
    classes.push('board-fill');
  }
  if (cell.pathFill) {
    classes.push('goal-path-fill');
  }
  if (cell.pathDirectionClass) {
    classes.push(cell.pathDirectionClass);
  }

  return cn(...classes);
}

// Finds the row/column encoded in a board cell's `id` ("row_column") under
// a client point - used to figure out which cell a touch-move is currently
// over, since touch events (unlike mouse) don't fire per-target as the
// finger moves.
function cellAtPoint(
  clientX: number,
  clientY: number
): { row: number; column: number } | null {
  const element = document.elementFromPoint(clientX, clientY);
  const cell = element?.closest('td[id]');
  if (!cell) return null;
  const [row, column] = cell.id.split('_').map(Number);
  if (Number.isNaN(row) || Number.isNaN(column)) return null;
  return { row, column };
}

const Board = ({
  rows,
  columns,
  startCoordinate,
  goalCoordinate,
  shouldBuildWalls,
  setShouldBuildWalls,
  pathAlgorithm,
  wallAlgorithm,
  paintMode,
  stepDelay,
  shouldVisualizePathAlgorithm,
  setShouldVisualizePathAlgorithm,
  shouldResetBoard,
  setShouldResetBoard,
  shouldResetPath,
  setShouldResetPath,
  onError,
  onStats,
}: IBoardParameters) => {
  // Contains all setTimeoutIds for the in-progress animation (wall building
  // and path search alike), so an immediate Reset can cancel them
  // (clearTimeout) instead of letting them keep firing and mutating state
  // after the board's already been cleared. It also doubles as the "is
  // anything still animating?" check that gates Build Walls/Visualize.
  const timeoutIdsRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  // Contains all the walls on the board
  const walls = React.useRef<Set<string>>(new Set<string>());

  // Contains all weighted-terrain cells and their traversal cost
  const weights = React.useRef<Map<string, number>>(new Map<string, number>());

  // Owns the *current* start/goal position (seeded from props, but then
  // independent of them) so dragging a marker doesn't need to round-trip
  // through the parent - props only matter again at the next full reset,
  // where resetBoard() below re-seeds from them.
  const [currentStart, setCurrentStart] =
    React.useState<CoordinateAndDirection>(startCoordinate);
  const [currentGoal, setCurrentGoal] =
    React.useState<CoordinateAndDirection>(goalCoordinate);

  const [cells, setCells] = React.useState<CellState[][]>(() =>
    buildInitialCells(rows, columns, startCoordinate, goalCoordinate)
  );

  // Schedules a timed animation step for the wall and search algorithms
  // (src/algorithms/walls.tsx, src/algorithms/paths.tsx) and tracks the timeout so it can be
  // cancelled on reset. paths.tsx owns the delay math; this just owns
  // bookkeeping/cancellation.
  const scheduleTimeout = React.useCallback(
    (callback: () => void, delay: number): void => {
      const id = setTimeout(() => {
        callback();
        timeoutIdsRef.current = timeoutIdsRef.current.filter(
          existingId => existingId !== id
        );
      }, delay);
      timeoutIdsRef.current.push(id);
    },
    []
  );

  const cancelPendingTimeouts = (): void => {
    timeoutIdsRef.current.forEach(id => clearTimeout(id));
    timeoutIdsRef.current = [];
  };

  // Tracks which cells have already been counted, so a cell discovered as
  // a child of multiple frontier nodes before it's actually popped (a
  // normal search occurrence) only counts once toward the live stat.
  const countedVisitedRef = React.useRef<Set<string>>(new Set());
  // The single source of truth for the currently-displayed stats. Every
  // onStats call reads/writes through this ref rather than constructing a
  // fresh object inline, specifically so the *live* visitedCount ticks
  // (fired repeatedly during animation, from handleCellVisited below)
  // don't clobber pathLength/algorithmTimeMs back to their placeholder
  // values - those are known synchronously, before the animation plays,
  // and must survive every visitedCount update that follows.
  const statsRef = React.useRef<RunStats>({
    visitedCount: 0,
    pathLength: null,
    algorithmTimeMs: -1,
  });

  const handleCellVisited = React.useCallback(
    (row: number, column: number): void => {
      const key = `${row}_${column}`;
      if (!countedVisitedRef.current.has(key)) {
        countedVisitedRef.current.add(key);
        statsRef.current = {
          ...statsRef.current,
          visitedCount: statsRef.current.visitedCount + 1,
        };
        onStats(statsRef.current);
      }

      setCells(prev => {
        const next = prev.map(r => r.slice());
        next[row][column] = { ...next[row][column], visited: true };
        return next;
      });
    },
    [onStats]
  );

  const handleGoalPathFill = React.useCallback(
    (row: number, column: number): void => {
      setCells(prev => {
        const next = prev.map(r => r.slice());
        next[row][column] = { ...next[row][column], pathFill: true };
        return next;
      });
    },
    []
  );

  const handlePathDirection = React.useCallback(
    (row: number, column: number, directionClass: string): void => {
      setCells(prev => {
        const next = prev.map(r => r.slice());
        next[row][column] = {
          ...next[row][column],
          pathDirectionClass: directionClass,
        };
        return next;
      });
    },
    []
  );

  const animationCallbacks = React.useMemo(
    () => ({
      onCellVisited: handleCellVisited,
      onGoalPathFill: handleGoalPathFill,
      onPathDirection: handlePathDirection,
    }),
    [handleCellVisited, handleGoalPathFill, handlePathDirection]
  );

  // Sets a single cell's paint state (empty/wall/weight), keeping the
  // walls/weights refs and visual `kind` in sync and mutually exclusive.
  const setPaintKind = React.useCallback(
    (row: number, column: number, kind: 'empty' | 'wall' | 'weight'): void => {
      const key = `${row}_${column}`;
      walls.current.delete(key);
      weights.current.delete(key);
      if (kind === 'wall') {
        walls.current.add(key);
      } else if (kind === 'weight') {
        weights.current.set(key, WEIGHT_VALUE);
      }

      setCells(prev => {
        const next = prev.map(r => r.slice());
        next[row][column] = { ...next[row][column], kind };
        return next;
      });
    },
    []
  );

  // Add/remove a wall or weighted-terrain cell at a coordinate (single
  // click/tap toggle) - if the algorithm has already been run, you can't
  // interact with the board again until it's reset.
  const togglePaint = React.useCallback(
    (row: number, column: number): void => {
      if (shouldVisualizePathAlgorithm) return;

      const cell = cells[row]?.[column];
      if (!cell) return;

      if (cell.kind === 'empty') {
        setPaintKind(row, column, paintMode);
      } else if (cell.kind === 'wall' || cell.kind === 'weight') {
        setPaintKind(row, column, 'empty');
      }
    },
    [cells, paintMode, setPaintKind, shouldVisualizePathAlgorithm]
  );

  // Add a wall to the board (no click event - used by the recursive/Prim's
  // wall algorithms)
  const buildWall = (rowNum: number, columnNum: number): void => {
    const key = `${rowNum}_${columnNum}`;
    if (!walls.current.has(key)) {
      weights.current.delete(key);
      walls.current.add(key);
      setCells(prev => {
        const next = prev.map(r => r.slice());
        next[rowNum][columnNum] = { ...next[rowNum][columnNum], kind: 'wall' };
        return next;
      });
    }
  };

  // Draw border walls and add inner walls recursively
  const addRecursiveWalls = (): void => {
    if (wallAlgorithm === 'RecursiveDivision') {
      drawBorderWalls(
        currentStart,
        currentGoal,
        rows,
        columns,
        buildWall,
        scheduleTimeout,
        stepDelay
      );
      recursiveDivision(
        0,
        currentStart,
        currentGoal,
        rows,
        columns,
        1,
        1,
        rows - 2,
        columns - 2,
        buildWall,
        scheduleTimeout,
        stepDelay
      );
    } else if (wallAlgorithm === 'RecursiveDivisionTwoLayers') {
      drawBorderWalls(
        currentStart,
        currentGoal,
        rows,
        columns,
        buildWall,
        scheduleTimeout,
        stepDelay
      );
      recursiveDivisionTwoLayers(
        0,
        currentStart,
        currentGoal,
        rows,
        columns,
        1,
        1,
        rows - 2,
        columns - 2,
        buildWall,
        scheduleTimeout,
        stepDelay
      );
    } else if (wallAlgorithm === 'Prims') {
      drawBorderWalls(
        currentStart,
        currentGoal,
        rows,
        columns,
        buildWall,
        scheduleTimeout,
        stepDelay
      );
      prims(
        0,
        currentStart,
        currentGoal,
        rows,
        columns,
        1,
        1,
        rows - 2,
        columns - 2,
        buildWall,
        scheduleTimeout,
        stepDelay
      );
    }
  };

  // Run the path finding algorithm
  // if algorithm has already been run, you can't run the algorithm again
  const runVisualizeAlgorithm = (): void => {
    let path = null;
    if (shouldVisualizePathAlgorithm) {
      onError(null);
      countedVisitedRef.current = new Set();
      statsRef.current = {
        visitedCount: 0,
        pathLength: null,
        algorithmTimeMs: -1,
      };
      onStats(statsRef.current);

      const startTime = performance.now();
      if (pathAlgorithm === 'BreadthFirstSearch') {
        path = unweightedSearch(
          rows,
          columns,
          currentStart,
          currentGoal,
          walls.current,
          'BreadthFirstSearch',
          scheduleTimeout,
          animationCallbacks,
          stepDelay
        );
      } else if (pathAlgorithm === 'DepthFirstSearch') {
        path = unweightedSearch(
          rows,
          columns,
          currentStart,
          currentGoal,
          walls.current,
          'DepthFirstSearch',
          scheduleTimeout,
          animationCallbacks,
          stepDelay
        );
      } else if (pathAlgorithm === 'GreedyBestFirstSearch') {
        path = weightedSearch(
          rows,
          columns,
          currentStart,
          currentGoal,
          walls.current,
          weights.current,
          'GreedyBestFirstSearch',
          scheduleTimeout,
          animationCallbacks,
          stepDelay
        );
      } else if (pathAlgorithm === 'DijkstrasAlgorithm') {
        path = weightedSearch(
          rows,
          columns,
          currentStart,
          currentGoal,
          walls.current,
          weights.current,
          'DijkstrasAlgorithm',
          scheduleTimeout,
          animationCallbacks,
          stepDelay
        );
      } else if (pathAlgorithm === 'AStarAlgorithm') {
        path = weightedSearch(
          rows,
          columns,
          currentStart,
          currentGoal,
          walls.current,
          weights.current,
          'AStarAlgorithm',
          scheduleTimeout,
          animationCallbacks,
          stepDelay
        );
      }
      const algorithmTimeMs = performance.now() - startTime;

      if (path === null) {
        onError('No path was found. Please try again.');
        statsRef.current = {
          ...statsRef.current,
          pathLength: null,
          algorithmTimeMs,
        };
      } else if (path.length === 0) {
        onError('The start is the goal. Please try again.');
        statsRef.current = {
          ...statsRef.current,
          pathLength: 0,
          algorithmTimeMs,
        };
      } else {
        statsRef.current = {
          ...statsRef.current,
          pathLength: path.length,
          algorithmTimeMs,
        };
      }
      onStats(statsRef.current);
    }
  };

  // --- Click/tap-and-drag paint + drag-to-move start/goal -----------------
  //
  // A single mousedown/touchstart on an interactive cell begins either a
  // paint stroke (dragging paints/erases every empty-or-paintable cell the
  // pointer subsequently enters) or, if it started on the start/goal
  // marker, a move of that marker. The decision and the paint stroke's
  // action ("add" vs "erase") are fixed for the whole gesture at
  // pointerdown, matching ordinary drag-paint tool behavior rather than
  // re-toggling every cell the pointer passes back over.
  const dragStateRef = React.useRef<
    | { kind: 'paint'; action: 'add' | 'erase' }
    | { kind: 'move-start' | 'move-goal' }
    | null
  >(null);

  const canDropAnchor = (row: number, column: number): boolean => {
    const cell = cells[row]?.[column];
    if (!cell) return false;
    if (row === currentGoal.row && column === currentGoal.column) return false;
    if (row === currentStart.row && column === currentStart.column)
      return false;
    return (
      cell.kind === 'empty' || cell.kind === 'wall' || cell.kind === 'weight'
    );
  };

  const moveAnchor = (
    which: 'start' | 'goal',
    row: number,
    column: number
  ): void => {
    if (!canDropAnchor(row, column)) return;

    const from = which === 'start' ? currentStart : currentGoal;
    const to: CoordinateAndDirection = { row, column, direction: '' };

    setPaintKind(from.row, from.column, 'empty');
    walls.current.delete(`${row}_${column}`);
    weights.current.delete(`${row}_${column}`);
    setCells(prev => {
      const next = prev.map(r => r.slice());
      next[row][column] = {
        kind: which === 'start' ? 'start' : 'goal',
        visited: false,
        pathFill: false,
        pathDirectionClass: null,
      };
      return next;
    });

    if (which === 'start') {
      setCurrentStart(to);
    } else {
      setCurrentGoal(to);
    }

    // The just-run (or never-run) path/visited overlay may no longer be
    // accurate against the new anchor position - clear it, but leave
    // walls/weights the user painted alone.
    cancelPendingTimeouts();
    setCells(prev =>
      prev.map(r =>
        r.map(cell => ({
          ...cell,
          visited: false,
          pathFill: false,
          pathDirectionClass: null,
        }))
      )
    );
  };

  const handlePointerDownOnCell = (row: number, column: number): void => {
    if (shouldVisualizePathAlgorithm) return;
    const cell = cells[row]?.[column];
    if (!cell) return;

    if (cell.kind === 'start') {
      dragStateRef.current = { kind: 'move-start' };
    } else if (cell.kind === 'goal') {
      dragStateRef.current = { kind: 'move-goal' };
    } else if (
      cell.kind === 'empty' ||
      cell.kind === 'wall' ||
      cell.kind === 'weight'
    ) {
      dragStateRef.current = {
        kind: 'paint',
        action: cell.kind === 'empty' ? 'add' : 'erase',
      };
      togglePaint(row, column);
    }
  };

  const handlePointerEnterCell = (row: number, column: number): void => {
    const drag = dragStateRef.current;
    if (!drag || shouldVisualizePathAlgorithm) return;

    if (drag.kind === 'move-start') {
      moveAnchor('start', row, column);
    } else if (drag.kind === 'move-goal') {
      moveAnchor('goal', row, column);
    } else if (drag.kind === 'paint') {
      const cell = cells[row]?.[column];
      if (!cell) return;
      if (drag.action === 'add' && cell.kind === 'empty') {
        setPaintKind(row, column, paintMode);
      } else if (
        drag.action === 'erase' &&
        (cell.kind === 'wall' || cell.kind === 'weight')
      ) {
        setPaintKind(row, column, 'empty');
      }
    }
  };

  const endDrag = (): void => {
    dragStateRef.current = null;
  };

  // Tracks the drag via a single window-level mousemove + elementFromPoint
  // (the same technique handleTouchMove below uses), rather than each
  // cell's own onMouseEnter. Per-cell mouseenter is fragile here: in a
  // fast synthetic/programmatic drag (and occasionally a fast real one),
  // the browser can deliver mouseup before mouseenter reaches the target
  // cell's listener, silently dropping the move. A single document-level
  // listener that re-derives the cell under the cursor on every mousemove
  // doesn't depend on that ordering at all.
  const handleWindowMouseMove = (event: MouseEvent): void => {
    if (!dragStateRef.current) return;
    const target = cellAtPoint(event.clientX, event.clientY);
    if (target) handlePointerEnterCell(target.row, target.column);
  };

  // Intentionally no dependency array: handlePointerEnterCell/endDrag are
  // plain functions redefined every render (closing over the latest
  // cells/currentStart/currentGoal/paintMode), so the listener is removed
  // and re-added each render to always use the freshest closure rather
  // than one captured from a stale render.
  React.useEffect(() => {
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', endDrag);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', endDrag);
    };
  });

  const handleTouchStartOnCell =
    (row: number, column: number) =>
    (event: React.TouchEvent<HTMLTableCellElement>): void => {
      event.preventDefault();
      handlePointerDownOnCell(row, column);
    };

  const handleTouchMove = (
    event: React.TouchEvent<HTMLTableCellElement>
  ): void => {
    if (!dragStateRef.current) return;
    event.preventDefault();
    const touch = event.touches[0];
    if (!touch) return;
    const target = cellAtPoint(touch.clientX, touch.clientY);
    if (target) handlePointerEnterCell(target.row, target.column);
  };

  // Creates the <rows> by <columns> board
  const createBoard = (): React.JSX.Element[] => {
    const maze: React.JSX.Element[] = [];

    for (let i = 0; i < rows; i++) {
      const rowCells: React.JSX.Element[] = [];
      for (let j = 0; j < columns; j++) {
        const cell = cells[i]?.[j] ?? {
          kind: 'empty' as CellKind,
          visited: false,
          pathFill: false,
          pathDirectionClass: null,
        };
        const isAnchor = cell.kind === 'start' || cell.kind === 'goal';
        const interactive =
          cell.kind === 'empty' ||
          cell.kind === 'wall' ||
          cell.kind === 'weight' ||
          isAnchor;

        rowCells.push(
          <td
            key={j}
            id={i.toString() + '_' + j.toString()}
            className={cn(getCellClassName(cell), isAnchor && 'cursor-grab')}
            onMouseDown={
              interactive ? () => handlePointerDownOnCell(i, j) : undefined
            }
            onTouchStart={
              interactive ? handleTouchStartOnCell(i, j) : undefined
            }
            onTouchMove={interactive ? handleTouchMove : undefined}
            onTouchEnd={
              interactive
                ? event => {
                    event.preventDefault();
                    endDrag();
                  }
                : undefined
            }
          >
            {cell.kind === 'start' ? 'S' : cell.kind === 'goal' ? 'G' : null}
          </td>
        );
      }
      maze.push(<tr key={i}>{rowCells}</tr>);
    }

    return maze;
  };

  // Clears the visited/path overlay from every cell, leaving wall/start/goal
  // kind untouched.
  const clearAlgorithmState = (): void => {
    setCells(prev =>
      prev.map(row =>
        row.map(cell => ({
          ...cell,
          visited: false,
          pathFill: false,
          pathDirectionClass: null,
        }))
      )
    );
  };

  // Resets the algorithm path created. Cancels any in-flight animation
  // timeouts first so a reset mid-visualization takes effect immediately
  // instead of being overwritten by callbacks still in flight.
  const resetPath = (): void => {
    cancelPendingTimeouts();
    clearAlgorithmState();
  };

  // Resets the entirety of the board (walls, weights, paths, and re-seeds
  // the current start/goal position from the latest props).
  const resetBoard = (): void => {
    cancelPendingTimeouts();
    walls.current.clear();
    weights.current.clear();
    setCurrentStart(startCoordinate);
    setCurrentGoal(goalCoordinate);
    setCells(buildInitialCells(rows, columns, startCoordinate, goalCoordinate));
  };

  // Check if walls can/should be built
  React.useEffect(() => {
    if (shouldBuildWalls && timeoutIdsRef.current.length === 0) {
      addRecursiveWalls();
    } else {
      setShouldBuildWalls(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldBuildWalls, timeoutIdsRef]);

  // Check if algorithm can/should be run
  React.useEffect(() => {
    if (shouldVisualizePathAlgorithm && timeoutIdsRef.current.length === 0) {
      runVisualizeAlgorithm();
    } else {
      setShouldVisualizePathAlgorithm(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldVisualizePathAlgorithm, timeoutIdsRef]);

  // Check if board path can/should be reset. Unlike build/visualize above,
  // this is never gated on pending timeouts - a reset always takes effect
  // immediately (cancelling any in-flight animation), rather than being
  // silently dropped while a visualization is still animating.
  React.useEffect(() => {
    if (shouldResetPath) {
      // shouldResetPath is an external one-shot command signal from the
      // parent (a button click), not state derivable during render -
      // synchronizing local cell state to it is exactly what this effect
      // is for.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetPath();
      setShouldVisualizePathAlgorithm(false);
      setShouldResetPath(false);
      onStats(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldResetPath]);

  // Check if board should be reset - same immediate-cancellation behavior
  // as resetPath above.
  React.useEffect(() => {
    if (shouldResetBoard) {
      // Same rationale as resetPath above - shouldResetBoard is an
      // external one-shot command signal, not derivable render state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetBoard();
      setShouldVisualizePathAlgorithm(false);
      setShouldResetPath(false);
      setShouldBuildWalls(false);
      setShouldResetBoard(false);
      onStats(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldResetBoard]);

  // Create board
  const board = createBoard();

  return (
    // No margin/padding here by design - the parent's board-area container
    // (configurations.tsx) measures its own content box via ResizeObserver
    // and sizes rows/columns to match exactly; any margin here would make
    // the table larger than that measurement and reintroduce the overflow
    // scrollbar the measurement is meant to prevent.
    <table className="table-fixed">
      <tbody>{board}</tbody>
    </table>
  );
};

const BoardConfigurationsAreEqual = (
  prevProps: IBoardParameters,
  nextProps: IBoardParameters
) => {
  const {
    shouldBuildWalls: prevBuildWalls,
    shouldVisualizePathAlgorithm: prevVisualizePath,
    shouldResetPath: prevResetPath,
    shouldResetBoard: prevResetBoard,
    paintMode: prevPaintMode,
  } = prevProps;

  const {
    shouldBuildWalls: nextBuildWalls,
    shouldVisualizePathAlgorithm: nextVisualizePath,
    shouldResetPath: nextResetPath,
    shouldResetBoard: nextResetBoard,
    paintMode: nextPaintMode,
  } = nextProps;

  // pathAlgorithm/wallAlgorithm/stepDelay are only ever read at the moment
  // one of the boolean signal flags above flips (Build Walls/Visualize
  // clicked) - by then Board will already be re-rendering for that reason,
  // picking up whatever the parent's latest value is, so they don't need
  // to be compared here. paintMode is different: it's read on every ad hoc
  // cell click/drag, with no flag-flip to force a re-render around it, so
  // skipping it here would let a stale closure paint with the wrong mode
  // after the user switches it.
  return (
    prevBuildWalls === nextBuildWalls &&
    prevVisualizePath === nextVisualizePath &&
    prevResetPath === nextResetPath &&
    prevResetBoard === nextResetBoard &&
    prevPaintMode === nextPaintMode
  );
};

const BoardMemo = React.memo(Board, BoardConfigurationsAreEqual);

export default BoardMemo;
