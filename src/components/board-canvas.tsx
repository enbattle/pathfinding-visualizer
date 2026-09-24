import React from 'react';
import { cn } from '@/lib/utils';
import {
  animationTicks,
  type CellKind,
  type PaintMode,
  type Visualizer,
} from '../visualizer/visualizer';
import { drawBoard, readPalette, type BoardPalette } from './board-renderer';
import { CELL_SIZE_PX } from './configurations-helpers';

interface BoardCanvasProps {
  visualizer: Visualizer;
  paintMode: PaintMode;
  className?: string;
}

const CELL_DESCRIPTIONS: Record<CellKind, string> = {
  empty: 'empty',
  wall: 'wall',
  weight: 'weighted terrain',
  start: 'start',
  goal: 'goal',
};

function isFocusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true; // selector unsupported: err on the side of showing it
  }
}

// Largest whole-pixel cell size at which the board fits the container.
function fitCellSize(
  width: number,
  height: number,
  rows: number,
  columns: number
): number {
  if (width <= 0 || height <= 0) return CELL_SIZE_PX;
  return Math.max(4, Math.floor(Math.min(width / columns, height / rows)));
}

/**
 * The board, drawn on a canvas. Drawing is a pure function of the
 * visualizer's snapshot and the playhead (see board-renderer.ts), redrawn
 * at most once per animation frame, and only when one of them changed.
 *
 * Input: pointer events (mouse, touch and pen through one API) start,
 * continue and end the visualizer's paint/move gestures. The canvas is
 * also keyboard-operable: arrow keys move a cursor, Space/Enter paints or
 * erases, and Space on S/G picks the marker up and drops it again.
 */
export function BoardCanvas({
  visualizer,
  paintMode,
  className,
}: BoardCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [cellSize, setCellSize] = React.useState(CELL_SIZE_PX);
  const [cursor, setCursor] = React.useState<number | null>(null);
  const [announcement, setAnnouncement] = React.useState('');
  const carryingRef = React.useRef(false);
  const lastCellRef = React.useRef<number | null>(null);

  const { rows, columns } = visualizer.getSnapshot().grid;

  // Fit the cell size to the container as it resizes. The board's rows and
  // columns never change here - resizing only rescales the drawing.
  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () =>
      setCellSize(
        fitCellSize(
          container.clientWidth,
          container.clientHeight,
          rows,
          columns
        )
      );
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [rows, columns]);

  // Redraw whenever the board, the playhead, the size or the cursor
  // changes, coalesced into one draw per animation frame.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return; // no 2D canvas (e.g. jsdom)

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(columns * cellSize * dpr);
    canvas.height = Math.round(rows * cellSize * dpr);
    const palette: BoardPalette = readPalette(canvas);

    let frame: number | null = null;
    const draw = () => {
      frame = null;
      const { tick, rate } = visualizer.player.getState();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBoard(ctx, visualizer.getSnapshot(), {
        tick,
        animationTicks: animationTicks(rate),
        cellSize,
        palette,
        cursor,
      });
    };
    const scheduleDraw = () => {
      if (frame === null) frame = requestAnimationFrame(draw);
    };

    draw();
    const unsubscribeBoard = visualizer.subscribe(scheduleDraw);
    const unsubscribePlayer = visualizer.player.subscribe(scheduleDraw);
    return () => {
      unsubscribeBoard();
      unsubscribePlayer();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [visualizer, rows, columns, cellSize, cursor]);

  const cellAt = (clientX: number, clientY: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const column = Math.floor(((clientX - rect.left) / rect.width) * columns);
    const row = Math.floor(((clientY - rect.top) / rect.height) * rows);
    if (row < 0 || row >= rows || column < 0 || column >= columns) return null;
    return row * columns + column;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    // Keep receiving moves even if the pointer leaves the canvas mid-drag.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    lastCellRef.current = cell;
    carryingRef.current = false;
    visualizer.beginGesture(cell, paintMode);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const cell = cellAt(event.clientX, event.clientY);
    if (!visualizer.gestureInProgress) {
      const kind = cell === null ? null : visualizer.cellKind(cell);
      event.currentTarget.style.cursor =
        kind === 'start' || kind === 'goal' ? 'grab' : 'pointer';
      return;
    }
    if (cell === null || cell === lastCellRef.current) return;
    lastCellRef.current = cell;
    visualizer.continueGesture(cell);
  };

  const endPointerGesture = () => {
    lastCellRef.current = null;
    visualizer.endGesture();
  };

  const announce = (cell: number) => {
    const row = Math.floor(cell / columns);
    const column = cell % columns;
    const carrying = carryingRef.current ? ' (carrying marker)' : '';
    setAnnouncement(
      `Row ${row + 1}, column ${column + 1}: ${CELL_DESCRIPTIONS[visualizer.cellKind(cell)]}${carrying}`
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const current = cursor ?? visualizer.getSnapshot().start;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const row = Math.min(
        rows - 1,
        Math.max(0, Math.floor(current / columns) + move[0])
      );
      const column = Math.min(
        columns - 1,
        Math.max(0, (current % columns) + move[1])
      );
      const next = row * columns + column;
      setCursor(next);
      if (carryingRef.current) visualizer.continueGesture(next);
      announce(next);
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (carryingRef.current) {
        carryingRef.current = false;
        visualizer.endGesture();
      } else {
        visualizer.beginGesture(current, paintMode);
        const kind = visualizer.cellKind(current);
        if (kind === 'start' || kind === 'goal') carryingRef.current = true;
        else visualizer.endGesture();
      }
      setCursor(current);
      announce(current);
      return;
    }
    if (event.key === 'Escape' && carryingRef.current) {
      carryingRef.current = false;
      visualizer.endGesture();
      announce(current);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full w-full items-center justify-center',
        className
      )}
    >
      <canvas
        ref={canvasRef}
        role="application"
        aria-roledescription="pathfinding board"
        aria-label={`Board, ${rows} rows by ${columns} columns. Arrow keys move the cursor; Space paints or erases a cell, or picks up and drops the start or goal marker.`}
        tabIndex={0}
        className="touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ width: columns * cellSize, height: rows * cellSize }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerGesture}
        onPointerCancel={endPointerGesture}
        onKeyDown={handleKeyDown}
        onFocus={event => {
          // Show the cursor for keyboard focus only, not after a click.
          if (isFocusVisible(event.currentTarget)) {
            setCursor(c => c ?? visualizer.getSnapshot().start);
          }
        }}
        onBlur={() => {
          setCursor(null);
          if (carryingRef.current) {
            carryingRef.current = false;
            visualizer.endGesture();
          }
        }}
      />
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
