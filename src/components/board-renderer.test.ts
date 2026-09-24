import { describe, it, expect } from 'vitest';
import { seededRandom } from '../engine';
import { FakeClock } from '../test-support/fake-clock';
import { Visualizer } from '../visualizer/visualizer';
import { cellLayer, drawBoard, mixColor, readPalette } from './board-renderer';

// 1x6 corridor: start 0, goal 5.
function corridor() {
  return new Visualizer({
    rows: 1,
    columns: 6,
    start: 0,
    goal: 5,
    clock: new FakeClock(),
  });
}

describe('cellLayer', () => {
  it('shows markers, painted walls and weights with no run', () => {
    const visualizer = corridor();
    visualizer.beginGesture(1, 'wall');
    visualizer.endGesture();
    visualizer.beginGesture(2, 'weight');
    visualizer.endGesture();
    const snapshot = visualizer.getSnapshot();
    expect(cellLayer(snapshot, 0, 0, 4)).toEqual({
      type: 'anchor',
      label: 'S',
    });
    expect(cellLayer(snapshot, 5, 0, 4)).toEqual({
      type: 'anchor',
      label: 'G',
    });
    expect(cellLayer(snapshot, 1, 0, 4)).toEqual({ type: 'wall', progress: 1 });
    expect(cellLayer(snapshot, 2, 0, 4)).toEqual({ type: 'weight' });
    expect(cellLayer(snapshot, 3, 0, 4)).toEqual({ type: 'empty' });
  });

  it('follows the playhead through discovery, then the path', () => {
    const visualizer = corridor();
    visualizer.beginGesture(2, 'weight');
    visualizer.endGesture();
    visualizer.visualize('bfs'); // discovers 1, 2, 3, 4 at ticks 0-3; path 1-4 at ticks 4-7
    const snapshot = visualizer.getSnapshot();

    expect(cellLayer(snapshot, 1, 0, 2)).toEqual({ type: 'empty' });
    expect(cellLayer(snapshot, 1, 1, 2)).toEqual({
      type: 'visited',
      progress: 0.5,
      weighted: false,
    });
    expect(cellLayer(snapshot, 2, 2, 2)).toEqual({
      type: 'visited',
      progress: 0.5,
      weighted: true,
    });
    expect(cellLayer(snapshot, 1, 4.5, 2)).toEqual({
      type: 'path',
      progress: 0.25,
      weighted: false,
    });
    expect(cellLayer(snapshot, 4, 100, 2)).toEqual({
      type: 'path',
      progress: 1,
      weighted: false,
    });
    // Scrubbing back hides them again.
    expect(cellLayer(snapshot, 4, 0, 2)).toEqual({ type: 'empty' });
  });

  it('hides maze walls until their tick, but always shows painted ones', () => {
    const visualizer = new Visualizer({
      rows: 9,
      columns: 9,
      start: 10,
      goal: 70,
      clock: new FakeClock(),
    });
    visualizer.buildMaze('recursive-division', seededRandom(2));
    const snapshot = visualizer.getSnapshot();
    const run = snapshot.run;
    if (run?.kind !== 'maze') throw new Error('expected a maze run');
    const wall = run.wallTick.findIndex(tick => tick > 0);
    expect(cellLayer(snapshot, wall, 0, 1)).toEqual({ type: 'empty' });
    expect(cellLayer(snapshot, wall, run.wallTick[wall] + 1, 1)).toEqual({
      type: 'wall',
      progress: 1,
    });
  });
});

describe('mixColor', () => {
  it('blends hex colors', () => {
    expect(mixColor('#000000', '#ffffff', 0)).toBe('rgb(0, 0, 0)');
    expect(mixColor('#000', '#fff', 1)).toBe('rgb(255, 255, 255)');
    expect(mixColor('#000000', '#ff0080', 0.5)).toBe('rgb(128, 0, 64)');
  });

  it('clamps the amount and passes non-hex colors through', () => {
    expect(mixColor('#000', '#fff', 2)).toBe('rgb(255, 255, 255)');
    expect(mixColor('red', '#fff', 0.5)).toBe('#fff');
  });
});

// Records the calls drawBoard makes; enough of CanvasRenderingContext2D
// for it to run.
function recordingContext() {
  const calls: string[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push(
        `${name}(${args.map(a => (typeof a === 'number' ? Math.round(a) : a)).join(',')})`
      );
  const ctx = {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    roundRect: record('roundRect'),
    rect: record('rect'),
    arc: record('arc'),
    fill: () => calls.push(`fill ${ctx.fillStyle}`),
    stroke: () => calls.push(`stroke ${ctx.strokeStyle}`),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    fillText: record('fillText'),
  };
  return ctx;
}

describe('drawBoard', () => {
  const palette = readPalette(document.body); // jsdom: the fallback palette

  it('fills settled cells with one fill per color and labels the markers', () => {
    const visualizer = corridor();
    const ctx = recordingContext();
    drawBoard(
      ctx as unknown as CanvasRenderingContext2D,
      visualizer.getSnapshot(),
      {
        tick: 0,
        animationTicks: 4,
        cellSize: 20,
        palette,
        cursor: null,
      }
    );
    const fills = ctx.calls.filter(call => call.startsWith('fill '));
    expect(fills).toEqual([`fill ${palette.anchor}`, `fill ${palette.empty}`]);
    expect(ctx.calls.filter(call => call.startsWith('roundRect'))).toHaveLength(
      6
    );
    expect(ctx.calls).toContain('fillText(S,10,11)');
    expect(ctx.calls).toContain('fillText(G,110,11)');
    expect(ctx.calls.some(call => call.startsWith('stroke'))).toBe(false);
  });

  it('draws the finished path as one line from start to goal, and the cursor', () => {
    const visualizer = corridor();
    visualizer.visualize('bfs');
    visualizer.player.finish();
    const ctx = recordingContext();
    drawBoard(
      ctx as unknown as CanvasRenderingContext2D,
      visualizer.getSnapshot(),
      {
        tick: visualizer.player.getState().tick,
        animationTicks: 4,
        cellSize: 20,
        palette,
        cursor: 3,
      }
    );
    expect(ctx.calls).toContain('moveTo(10,10)');
    expect(ctx.calls.filter(call => call.startsWith('lineTo'))).toEqual([
      'lineTo(30,10)',
      'lineTo(50,10)',
      'lineTo(70,10)',
      'lineTo(90,10)',
      'lineTo(110,10)',
    ]);
    expect(ctx.calls).toContain(`stroke ${palette.pathLine}`);
    expect(ctx.calls).toContain(`stroke ${palette.cursor}`);
  });
});
