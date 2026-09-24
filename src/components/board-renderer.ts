import {
  entranceProgress,
  isRevealed,
  NEVER,
  type Run,
} from '../visualizer/runs';
import type { VisualizerSnapshot } from '../visualizer/visualizer';

// Draws one board (the shared grid plus one run) onto a 2D canvas.
// Everything here is a pure function of (board snapshot, run, playhead
// tick): no state and no timers, so scrubbing the playhead backwards or
// forwards always draws exactly the right frame.

/** What a cell shows at a given playhead position. */
export type CellLayer =
  | { readonly type: 'empty' }
  | { readonly type: 'weight' }
  | { readonly type: 'start' }
  | { readonly type: 'goal' }
  | { readonly type: 'wall'; readonly progress: number }
  | {
      readonly type: 'visited';
      readonly progress: number;
      readonly weighted: boolean;
      /** Discovery order, 0 (first) to 1 (last) - drives the color ramp. */
      readonly order: number;
    }
  | {
      readonly type: 'path';
      readonly progress: number;
      readonly weighted: boolean;
    };

export function cellLayer(
  snapshot: VisualizerSnapshot,
  run: Run | null,
  index: number,
  tick: number,
  animationTicks: number
): CellLayer {
  const { grid } = snapshot;
  if (index === snapshot.start) return { type: 'start' };
  if (index === snapshot.goal) return { type: 'goal' };

  if (grid.walls[index]) {
    // While a maze animates, its walls appear on their own ticks; walls the
    // user painted (not part of the maze) are always shown.
    const revealTick = run?.kind === 'maze' ? run.wallTick[index] : NEVER;
    if (revealTick === NEVER) return { type: 'wall', progress: 1 };
    return isRevealed(revealTick, tick)
      ? {
          type: 'wall',
          progress: entranceProgress(revealTick, tick, animationTicks),
        }
      : { type: 'empty' };
  }

  const weighted = grid.weights[index] > 1;
  if (run?.kind === 'search') {
    const pathTick = run.pathTick[index];
    if (isRevealed(pathTick, tick)) {
      return {
        type: 'path',
        progress: entranceProgress(pathTick, tick, animationTicks),
        weighted,
      };
    }
    const discoverTick = run.discoverTick[index];
    if (isRevealed(discoverTick, tick)) {
      return {
        type: 'visited',
        progress: entranceProgress(discoverTick, tick, animationTicks),
        weighted,
        order: run.discoveries > 1 ? discoverTick / (run.discoveries - 1) : 0,
      };
    }
  }
  return weighted ? { type: 'weight' } : { type: 'empty' };
}

/** Board colors, read from CSS custom properties so theming stays in CSS. */
export interface BoardPalette {
  readonly gridLine: string;
  readonly empty: string;
  readonly wall: string;
  readonly weight: string;
  readonly weightMark: string;
  readonly start: string;
  readonly goal: string;
  readonly anchorText: string;
  /** Color a newly discovered cell flashes in with. */
  readonly visitedFlash: string;
  /** Settled visited color for the first-discovered cells... */
  readonly visitedNear: string;
  /** ...blending to this for the last-discovered ones. */
  readonly visitedFar: string;
  readonly pathFlash: string;
  readonly path: string;
  readonly pathLine: string;
  readonly pathGlow: string;
  readonly cursor: string;
}

const FALLBACK_PALETTE: BoardPalette = {
  gridLine: '#0a0d13',
  empty: '#161b26',
  wall: '#c7d2e0',
  weight: '#3d2e16',
  weightMark: '#f59e0b',
  start: '#22c55e',
  goal: '#f43f5e',
  anchorText: '#05080d',
  visitedFlash: '#e0f2fe',
  visitedNear: '#22d3ee',
  visitedFar: '#6366f1',
  pathFlash: '#fff7ed',
  path: '#fbbf24',
  pathLine: '#fffbeb',
  pathGlow: '#fbbf24',
  cursor: '#f8fafc',
};

const PALETTE_VARIABLES: Record<keyof BoardPalette, string> = {
  gridLine: '--board-grid-line',
  empty: '--board-empty',
  wall: '--board-wall',
  weight: '--board-weight',
  weightMark: '--board-weight-mark',
  start: '--board-start',
  goal: '--board-goal',
  anchorText: '--board-anchor-text',
  visitedFlash: '--board-visited-flash',
  visitedNear: '--board-visited-near',
  visitedFar: '--board-visited-far',
  pathFlash: '--board-path-flash',
  path: '--board-path',
  pathLine: '--board-path-line',
  pathGlow: '--board-path-glow',
  cursor: '--board-cursor',
};

export function readPalette(element: Element): BoardPalette {
  const style = getComputedStyle(element);
  const palette = { ...FALLBACK_PALETTE };
  for (const key of Object.keys(PALETTE_VARIABLES) as (keyof BoardPalette)[]) {
    const value = style.getPropertyValue(PALETTE_VARIABLES[key]).trim();
    if (value) palette[key] = value;
  }
  return palette;
}

function parseHex(color: string): [number, number, number] | null {
  const hex = color.startsWith('#') ? color.slice(1) : '';
  if (hex.length === 3) {
    return [0, 1, 2].map(i => parseInt(hex[i] + hex[i], 16)) as [
      number,
      number,
      number,
    ];
  }
  if (hex.length === 6) {
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) as [
      number,
      number,
      number,
    ];
  }
  return null;
}

/** Linear blend of two hex colors; falls back to `to` for non-hex input. */
export function mixColor(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return to;
  const t = Math.max(0, Math.min(1, amount));
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

// Settled visited cells use one of this many colors along the ramp, so they
// still batch into a few fills.
const RAMP_STEPS = 24;

// Precomputed colors for one palette.
class ColorCache {
  private readonly ramp: string[];
  private readonly mixes = new Map<string, string>();

  constructor(readonly palette: BoardPalette) {
    this.ramp = Array.from({ length: RAMP_STEPS }, (_, i) =>
      mixColor(palette.visitedNear, palette.visitedFar, i / (RAMP_STEPS - 1))
    );
  }

  visited(order: number): string {
    return this.ramp[Math.round(order * (RAMP_STEPS - 1))];
  }

  // Entrance colors, quantized to 1/16ths of the animation.
  entrance(from: string, to: string, progress: number): string {
    const step = Math.round(progress * 16);
    const key = `${from}|${to}|${step}`;
    let color = this.mixes.get(key);
    if (!color) this.mixes.set(key, (color = mixColor(from, to, step / 16)));
    return color;
  }
}

const colorCaches = new WeakMap<BoardPalette, ColorCache>();
function colorsFor(palette: BoardPalette): ColorCache {
  let cache = colorCaches.get(palette);
  if (!cache) colorCaches.set(palette, (cache = new ColorCache(palette)));
  return cache;
}

// Settled cells are bucketed by color and filled with one fill() per color
// (a few dozen draw calls per frame instead of one per cell).
class CellBatch {
  private readonly shapes = new Map<string, number[]>();

  add(color: string, x: number, y: number, size: number, radius: number): void {
    let list = this.shapes.get(color);
    if (!list) this.shapes.set(color, (list = []));
    list.push(x, y, size, radius);
  }

  fill(ctx: CanvasRenderingContext2D): void {
    for (const [color, list] of this.shapes) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < list.length; i += 4) {
        const x = list[i];
        const y = list[i + 1];
        const size = list[i + 2];
        const radius = list[i + 3];
        if (ctx.roundRect) ctx.roundRect(x, y, size, size, radius);
        else ctx.rect(x, y, size, size);
      }
      ctx.fill();
    }
  }
}

export interface DrawOptions {
  /** Which run to draw on the board (null: just the board). */
  readonly run: Run | null;
  readonly tick: number;
  readonly animationTicks: number;
  /** CSS pixels per cell. */
  readonly cellSize: number;
  readonly palette: BoardPalette;
  /** Keyboard cursor cell, or null when the board isn't focused. */
  readonly cursor: number | null;
}

// Entrances grow from a dot to a full cell and ease out.
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  snapshot: VisualizerSnapshot,
  { run, tick, animationTicks, cellSize, palette, cursor }: DrawOptions
): void {
  const { rows, columns } = snapshot.grid;
  const colors = colorsFor(palette);
  const gap = Math.max(1, Math.round(cellSize * 0.08));
  const inner = cellSize - gap;
  const radius = inner * 0.24;

  ctx.fillStyle = palette.gridLine;
  ctx.fillRect(0, 0, columns * cellSize, rows * cellSize);

  const batch = new CellBatch();
  const labels: { x: number; y: number; label: string }[] = [];
  const weightMarks: { x: number; y: number }[] = [];

  const addCell = (index: number, color: string, progress = 1) => {
    const column = index % columns;
    const row = (index - column) / columns;
    const scale = 0.3 + 0.7 * easeOut(progress);
    const size = inner * scale;
    const x = column * cellSize + gap / 2 + (inner - size) / 2;
    const y = row * cellSize + gap / 2 + (inner - size) / 2;
    // Mid-entrance cells start round and square off as they grow.
    const cornerRadius =
      progress < 1
        ? size / 2 - (size / 2 - radius) * easeOut(progress)
        : radius;
    batch.add(color, x, y, size, cornerRadius);
    return {
      x: column * cellSize + cellSize / 2,
      y: row * cellSize + cellSize / 2,
    };
  };

  // An overlay that grows in over a base cell, blending from `flash` to its
  // settled color.
  const addEntrance = (
    index: number,
    base: string,
    flash: string,
    settled: string,
    progress: number
  ) => {
    addCell(index, base);
    return addCell(
      index,
      progress < 1 ? colors.entrance(flash, settled, progress) : settled,
      progress
    );
  };

  for (let index = 0; index < rows * columns; index++) {
    const layer = cellLayer(snapshot, run, index, tick, animationTicks);
    switch (layer.type) {
      case 'empty':
        addCell(index, palette.empty);
        break;
      case 'weight':
        weightMarks.push(addCell(index, palette.weight));
        break;
      case 'start':
        labels.push({ ...addCell(index, palette.start), label: 'S' });
        break;
      case 'goal':
        labels.push({ ...addCell(index, palette.goal), label: 'G' });
        break;
      case 'wall':
        addEntrance(
          index,
          palette.empty,
          palette.empty,
          palette.wall,
          layer.progress
        );
        break;
      case 'visited': {
        const center = addEntrance(
          index,
          layer.weighted ? palette.weight : palette.empty,
          palette.visitedFlash,
          colors.visited(layer.order),
          layer.progress
        );
        if (layer.weighted) weightMarks.push(center);
        break;
      }
      case 'path': {
        const center = addEntrance(
          index,
          layer.weighted ? palette.weight : palette.empty,
          palette.pathFlash,
          palette.path,
          layer.progress
        );
        if (layer.weighted) weightMarks.push(center);
        break;
      }
    }
  }
  batch.fill(ctx);

  // Weighted terrain keeps a small marker even under the search overlay.
  if (weightMarks.length > 0) {
    ctx.fillStyle = palette.weightMark;
    ctx.beginPath();
    const markRadius = Math.max(1.5, inner * 0.14);
    for (const { x, y } of weightMarks) {
      ctx.moveTo(x + markRadius, y);
      ctx.arc(x, y, markRadius, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  drawPathLine(ctx, snapshot, run, tick, cellSize, palette);

  ctx.fillStyle = palette.anchorText;
  ctx.font = `700 ${Math.round(inner * 0.5)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const { x, y, label } of labels) ctx.fillText(label, x, y + 0.5);

  if (cursor !== null) {
    const column = cursor % columns;
    const row = (cursor - column) / columns;
    ctx.strokeStyle = palette.cursor;
    ctx.lineWidth = Math.max(2, gap);
    ctx.beginPath();
    const x = column * cellSize + gap / 2;
    const y = row * cellSize + gap / 2;
    if (ctx.roundRect) ctx.roundRect(x, y, inner, inner, radius);
    else ctx.rect(x, y, inner, inner);
    ctx.stroke();
  }
}

// The found path as a glowing line through cell centers, growing with the
// playhead and joining the goal once the last path cell is drawn.
function drawPathLine(
  ctx: CanvasRenderingContext2D,
  snapshot: VisualizerSnapshot,
  run: Run | null,
  tick: number,
  cellSize: number,
  palette: BoardPalette
): void {
  const path = run?.kind === 'search' ? run.result.path : null;
  if (!run || run.kind !== 'search' || !path || path.length < 2) return;

  const { columns } = snapshot.grid;
  const center = (index: number): [number, number] => {
    const column = index % columns;
    const row = (index - column) / columns;
    return [column * cellSize + cellSize / 2, row * cellSize + cellSize / 2];
  };

  // Revealed prefix of the path: every interior cell whose tick has passed,
  // then the goal once the whole run has played.
  const points: [number, number][] = [center(path[0])];
  for (let i = 1; i < path.length; i++) {
    const isGoal = i === path.length - 1;
    if (!isGoal && !isRevealed(run.pathTick[path[i]], tick)) break;
    if (isGoal && tick < run.length) break;
    points.push(center(path[i]));
  }
  // (A zero-length stroke would still draw a round-capped dot.)
  if (points.length < 2) return;

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Glow: a wide translucent stroke under a thin bright one.
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = palette.pathGlow;
  ctx.lineWidth = Math.max(4, cellSize * 0.55);
  trace();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = palette.pathLine;
  ctx.lineWidth = Math.max(1.5, cellSize * 0.14);
  trace();
}
