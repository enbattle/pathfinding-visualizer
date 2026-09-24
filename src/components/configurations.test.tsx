import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import Configuration from './configurations';
import { FakeClock } from '../test-support/fake-clock';
import { Visualizer, type VisualizerOptions } from '../visualizer/visualizer';

// Forces the >=20 floor in computeBoardSize, giving every test the same
// 20x20 board (start on row 18, goal on row 1) regardless of the test
// runner's window size.
function setSmallViewport(): void {
  Object.defineProperty(window, 'innerWidth', {
    value: 100,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: 100,
    configurable: true,
    writable: true,
  });
}

const CELL = 10; // px per cell in the mocked canvas layout
const COLUMNS = 20;

let clock: FakeClock;
let visualizer: Visualizer;

function renderApp() {
  clock = new FakeClock();
  const createVisualizer = (options: VisualizerOptions) => {
    visualizer = new Visualizer({ ...options, clock });
    return visualizer;
  };
  const result = render(<Configuration createVisualizer={createVisualizer} />);
  const canvas = screen.getByRole('application');
  // jsdom doesn't lay out; give the canvas a 20x20-cell box at the origin.
  canvas.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: COLUMNS * CELL,
      height: 20 * CELL,
      right: COLUMNS * CELL,
      bottom: 20 * CELL,
      x: 0,
      y: 0,
    }) as DOMRect;
  return { ...result, canvas };
}

const index = (row: number, column: number) => row * COLUMNS + column;
const point = (cell: number) => ({
  clientX: (cell % COLUMNS) * CELL + CELL / 2,
  clientY: Math.floor(cell / COLUMNS) * CELL + CELL / 2,
  pointerId: 1,
});

function drag(canvas: HTMLElement, cells: number[]): void {
  fireEvent.pointerDown(canvas, { ...point(cells[0]), button: 0 });
  for (const cell of cells.slice(1)) fireEvent.pointerMove(canvas, point(cell));
  fireEvent.pointerUp(canvas, point(cells[cells.length - 1]));
}

const click = (canvas: HTMLElement, cell: number) => drag(canvas, [cell]);
const button = (name: string) => screen.getByRole('button', { name });
const frames = (ms: number) => act(() => clock.advance(ms));
const playToEnd = () => act(() => clock.runUntilIdle());
const snapshot = () => visualizer.getSnapshot();
const wallCount = () =>
  snapshot().grid.walls.reduce((sum, wall) => sum + wall, 0);

function stat(label: string): string {
  const status = screen.getByRole('status');
  const cell = within(status).getByText(label).parentElement as HTMLElement;
  return cell.firstElementChild?.textContent ?? '';
}

describe('Configuration (component/integration)', () => {
  beforeEach(setSmallViewport);
  afterEach(() => vi.restoreAllMocks());

  it('Build Walls animates a maze onto the board', () => {
    renderApp();
    fireEvent.click(button('Build Walls'));
    expect(wallCount()).toBeGreaterThan(0);
    expect(visualizer.player.getState().playing).toBe(true);
    playToEnd();
    expect(visualizer.player.getState().playing).toBe(false);
  });

  it('Visualize shows stats, with the visited count following playback', () => {
    renderApp();
    fireEvent.click(button('Visualize'));
    expect(stat('Nodes visited')).toBe('0');
    expect(Number(stat('Path length'))).toBeGreaterThan(0);
    expect(stat('Algorithm time')).toMatch(/ms$/);

    frames(100);
    const partway = Number(stat('Nodes visited'));
    expect(partway).toBeGreaterThan(0);
    playToEnd();
    expect(Number(stat('Nodes visited'))).toBeGreaterThan(partway);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('playback controls pause, step and scrub the run', () => {
    renderApp();
    fireEvent.click(button('Visualize'));
    frames(100);
    fireEvent.click(button('Pause'));
    const paused = visualizer.player.getState().tick;
    frames(500);
    expect(visualizer.player.getState().tick).toBe(paused);

    fireEvent.click(button('Step forward'));
    expect(visualizer.player.getState().tick).toBe(Math.floor(paused) + 1);
    fireEvent.click(button('Step back'));
    fireEvent.click(button('Step back'));
    expect(visualizer.player.getState().tick).toBe(Math.floor(paused) - 1);

    fireEvent.click(button('Skip to end'));
    const { tick, length } = visualizer.player.getState();
    expect(tick).toBe(length);
    fireEvent.click(button('Play')); // at the end: replays from the start
    expect(visualizer.player.getState()).toMatchObject({
      tick: 0,
      playing: true,
    });
  });

  it('Reset Path clears the run but leaves walls in place', () => {
    renderApp();
    fireEvent.click(button('Build Walls'));
    playToEnd();
    const walls = wallCount();
    fireEvent.click(button('Visualize'));
    playToEnd();

    fireEvent.click(button('Reset Path'));
    expect(snapshot().run).toBeNull();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Playback' })
    ).not.toBeInTheDocument();
    expect(wallCount()).toBe(walls);
  });

  it('Reset All clears walls and the run', () => {
    renderApp();
    fireEvent.click(button('Build Walls'));
    playToEnd();
    fireEvent.click(button('Visualize'));
    fireEvent.click(button('Reset All'));
    expect(wallCount()).toBe(0);
    expect(snapshot().run).toBeNull();
  });

  it('paint mode controls whether a click paints a wall or weighted terrain', () => {
    const { canvas } = renderApp();
    click(canvas, index(5, 5));
    expect(visualizer.cellKind(index(5, 5))).toBe('wall');

    fireEvent.click(button('Weighted Terrain'));
    click(canvas, index(5, 6));
    expect(visualizer.cellKind(index(5, 6))).toBe('weight');
  });

  it('click-and-drag paints, and a drag starting on a painted cell erases', () => {
    const { canvas } = renderApp();
    const cells = [index(5, 5), index(5, 6), index(5, 7), index(6, 7)];
    drag(canvas, cells);
    for (const cell of cells) expect(visualizer.cellKind(cell)).toBe('wall');

    drag(canvas, cells.slice().reverse());
    for (const cell of cells) expect(visualizer.cellKind(cell)).toBe('empty');
  });

  it('dragging start or goal moves the marker the search actually uses', () => {
    const { canvas } = renderApp();
    const { start, goal } = snapshot();
    const newStart = index(10, 3);
    const newGoal = index(10, 16);
    drag(canvas, [start, newStart]);
    drag(canvas, [goal, newGoal]);
    expect(snapshot()).toMatchObject({ start: newStart, goal: newGoal });

    fireEvent.click(button('Visualize'));
    const run = snapshot().run;
    const path = run?.kind === 'search' ? run.result.path : null;
    expect(path?.[0]).toBe(newStart);
    expect(path?.[path.length - 1]).toBe(newGoal);
  });

  it('editing after a search re-runs it live', () => {
    const { canvas } = renderApp();
    fireEvent.click(button('Visualize'));
    playToEnd();
    const { goal } = snapshot();
    const moved = goal + 1;
    drag(canvas, [goal, moved]);
    const run = snapshot().run;
    expect(run?.kind === 'search' && run.result.path?.at(-1)).toBe(moved);
    expect(visualizer.player.getState().playing).toBe(false);
  });

  it('resetting mid-visualization stops the animation', () => {
    renderApp();
    fireEvent.click(button('Visualize'));
    frames(50);
    fireEvent.click(button('Reset All'));
    expect(clock.pendingFrames).toBe(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    frames(10_000);
    expect(snapshot().run).toBeNull();
  });

  it('resetting mid-wall-build leaves no walls and no animation behind', () => {
    renderApp();
    fireEvent.click(button('Build Walls'));
    frames(50);
    fireEvent.click(button('Reset All'));
    expect(wallCount()).toBe(0);
    expect(clock.pendingFrames).toBe(0);
    frames(10_000);
    expect(wallCount()).toBe(0);
  });

  it('Visualize during a wall build searches the finished maze', () => {
    renderApp();
    fireEvent.click(button('Build Walls'));
    frames(50);
    const walls = wallCount();
    fireEvent.click(button('Visualize'));
    expect(snapshot().run?.kind).toBe('search');
    expect(wallCount()).toBe(walls);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('speed slider changes the playback rate', () => {
    renderApp();
    const before = visualizer.player.getState().rate;
    const thumb = screen.getByRole('slider', { name: 'Animation speed' });
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(visualizer.player.getState().rate).toBeLessThan(before);
  });

  it('the board is keyboard-operable', () => {
    const { canvas } = renderApp();
    act(() => canvas.focus());
    const { start } = snapshot();
    // Cursor starts on S; move up and paint.
    fireEvent.keyDown(canvas, { key: 'ArrowUp' });
    fireEvent.keyDown(canvas, { key: ' ' });
    expect(visualizer.cellKind(start - COLUMNS)).toBe('wall');
    expect(screen.getByText(/Row 18, column \d+: wall/)).toBeInTheDocument();

    // Pick S up, carry it right, drop it.
    fireEvent.keyDown(canvas, { key: 'ArrowDown' });
    fireEvent.keyDown(canvas, { key: ' ' });
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    fireEvent.keyDown(canvas, { key: ' ' });
    expect(snapshot().start).toBe(start + 1);
  });

  it('info dialog opens on click and closes on Escape', async () => {
    renderApp();
    fireEvent.click(button('About this app'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('shows an error when the goal is sealed off, and clears it on reset', () => {
    const { canvas } = renderApp();
    const { goal } = snapshot();
    for (const neighbor of [
      goal - COLUMNS,
      goal + COLUMNS,
      goal - 1,
      goal + 1,
    ]) {
      click(canvas, neighbor);
    }
    fireEvent.click(button('Visualize'));
    expect(screen.getByRole('alert')).toHaveTextContent('No path was found');
    fireEvent.click(button('Reset All'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
