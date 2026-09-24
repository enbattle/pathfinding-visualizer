import { entranceProgress, isRevealed, NEVER } from '../visualizer/runs';
import type { VisualizerSnapshot } from '../visualizer/visualizer';

// Draws the board onto a 2D canvas. Everything here is a pure function of
// (board snapshot, playhead tick): no state, no timers, so scrubbing the
// playhead backwards or forwards always draws exactly the right frame.

/** What a cell shows at a given playhead position. */
export type CellLayer =
  | { readonly type: 'empty' }
  | { readonly type: 'weight' }
  | { readonly type: 'anchor'; readonly label: 'S' | 'G' }
  | { readonly type: 'wall'; readonly progress: number }
  | {
      readonly type: 'visited';
      readonly progress: number;
      readonly weighted: boolean;
    }
  | {
      readonly type: 'path';
      readonly progress: number;
      readonly weighted: boolean;
    };

export function cellLayer(
  snapshot: VisualizerSnapshot,
  index: number,
  tick: number,
  animationTicks: number
): CellLayer {
  const { grid, run } = snapshot;
  if (index === snapshot.start) return { type: 'anchor', label: 'S' };
  if (index === snapshot.goal) return { type: 'anchor', label: 'G' };

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
  readonly anchor: string;
  readonly anchorText: string;
  readonly visitedFrom: string;
  readonly visitedTo: string;
  readonly pathFrom: string;
  readonly pathTo: string;
  readonly pathLine: string;
  readonly cursor: string;
}

const FALLBACK_PALETTE: BoardPalette = {
  gridLine: '#0b0e14',
  empty: '#171a23',
  wall: '#483c32',
  weight: '#b8860b',
  anchor: '#ffd700',
  anchorText: '#1a1300',
  visitedFrom: '#f5f5dc',
  visitedTo: '#7fffd4',
  pathFrom: '#ff4500',
  pathTo: '#ffff00',
  pathLine: '#0b0e14',
  cursor: '#22d3ee',
};

const PALETTE_VARIABLES: Record<keyof BoardPalette, string> = {
  gridLine: '--board-grid-line',
  empty: '--board-empty',
  wall: '--board-wall',
  weight: '--board-weight',
  anchor: '--board-anchor',
  anchorText: '--board-anchor-text',
  visitedFrom: '--board-visited-from',
  visitedTo: '--board-visited-to',
  pathFrom: '--board-path-from',
  pathTo: '--board-path-to',
  pathLine: '--board-path-line',
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

// Settled cells are bucketed by color and filled with one fill() per color
// (a few draw calls per frame instead of one per cell); only cells still
// mid-animation get their own color.
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
        const [x, y, size, radius] = [
          list[i],
          list[i + 1],
          list[i + 2],
          list[i + 3],
        ];
        if (ctx.roundRect) ctx.roundRect(x, y, size, size, radius);
        else ctx.rect(x, y, size, size);
      }
      ctx.fill();
    }
  }
}

export interface DrawOptions {
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
  { tick, animationTicks, cellSize, palette, cursor }: DrawOptions
): void {
  const { rows, columns } = snapshot.grid;
  const gap = Math.max(1, Math.round(cellSize * 0.08));
  const inner = cellSize - gap;
  const radius = inner * 0.22;

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

  for (let index = 0; index < rows * columns; index++) {
    const layer = cellLayer(snapshot, index, tick, animationTicks);
    switch (layer.type) {
      case 'empty':
        addCell(index, palette.empty);
        break;
      case 'weight':
        weightMarks.push(addCell(index, palette.weight));
        break;
      case 'anchor':
        labels.push({ ...addCell(index, palette.anchor), label: layer.label });
        break;
      case 'wall':
        addCell(index, palette.empty);
        addCell(
          index,
          layer.progress < 1
            ? mixColor(palette.visitedFrom, palette.wall, layer.progress)
            : palette.wall,
          layer.progress
        );
        break;
      case 'visited':
      case 'path': {
        const [from, to] =
          layer.type === 'path'
            ? [palette.pathFrom, palette.pathTo]
            : [palette.visitedFrom, palette.visitedTo];
        addCell(index, layer.weighted ? palette.weight : palette.empty);
        const center = addCell(
          index,
          layer.progress < 1 ? mixColor(from, to, layer.progress) : to,
          layer.progress
        );
        if (layer.weighted) weightMarks.push(center);
        break;
      }
    }
  }
  batch.fill(ctx);

  // Weighted terrain keeps a small marker even under the search overlay.
  ctx.fillStyle = palette.weight;
  for (const { x, y } of weightMarks) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.5, inner * 0.14), 0, Math.PI * 2);
    ctx.fill();
  }

  drawPathLine(ctx, snapshot, tick, cellSize, palette);

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

// The found path as a line through cell centers, growing with the playhead
// and joining the goal once the last path cell is drawn.
function drawPathLine(
  ctx: CanvasRenderingContext2D,
  snapshot: VisualizerSnapshot,
  tick: number,
  cellSize: number,
  palette: BoardPalette
): void {
  const run = snapshot.run;
  const path = run?.kind === 'search' ? run.result.path : null;
  if (!run || run.kind !== 'search' || !path || path.length < 2) return;

  const { columns } = snapshot.grid;
  const center = (index: number): [number, number] => {
    const column = index % columns;
    const row = (index - column) / columns;
    return [column * cellSize + cellSize / 2, row * cellSize + cellSize / 2];
  };

  ctx.strokeStyle = palette.pathLine;
  ctx.lineWidth = Math.max(2, cellSize * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Revealed prefix of the path: every interior cell whose tick has passed,
  // then the goal once the whole run has played.
  let segments = 0;
  ctx.beginPath();
  ctx.moveTo(...center(path[0]));
  for (let i = 1; i < path.length; i++) {
    const isGoal = i === path.length - 1;
    if (!isGoal && !isRevealed(run.pathTick[path[i]], tick)) break;
    if (isGoal && tick < run.length) break;
    ctx.lineTo(...center(path[i]));
    segments++;
  }
  // (A zero-length stroke would still draw a round-capped dot.)
  if (segments > 0) ctx.stroke();
}
