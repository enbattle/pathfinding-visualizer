import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import Workspace from './workspace';
import { encodeShare } from '../visualizer/share';
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
  const result = render(<Workspace createVisualizer={createVisualizer} />);
  // jsdom doesn't lay out; give each board canvas a 20x20-cell box at the
  // origin. (A shared race link opens several boards.)
  const canvases = screen.getAllByRole('application');
  for (const canvas of canvases) {
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
  }
  return { ...result, canvas: canvases[0] };
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

// The value shown under a stat's label in the run statistics.
function stat(label: string): string {
  const status = screen.getByRole('status', { name: 'Run statistics' });
  return within(status).getByText(label).nextElementSibling?.textContent ?? '';
}

describe('Workspace (component/integration)', () => {
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
    expect(snapshot().runs).toEqual([]);
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
    expect(snapshot().runs).toEqual([]);
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
    const run = snapshot().runs[0];
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
    const run = snapshot().runs[0];
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
    expect(snapshot().runs).toEqual([]);
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
    expect(snapshot().runs[0]?.kind).toBe('search');
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

describe('Workspace: race mode', () => {
  beforeEach(setSmallViewport);

  it('races the selected algorithms side by side and ranks them', () => {
    renderApp();
    fireEvent.click(button('Race'));
    fireEvent.click(button('Start race'));
    // Default racers: Dijkstra, A*, Greedy - one board each.
    expect(screen.getAllByRole('application')).toHaveLength(3);
    expect(
      snapshot().runs.map(run => run.kind === 'search' && run.algorithm)
    ).toEqual(['greedy', 'dijkstra', 'astar']);

    playToEnd();
    const standings = screen.getByRole('status', { name: 'Race standings' });
    const rows = within(standings).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    // On an open board every racer reaches the goal; Dijkstra and A* are
    // always optimal.
    for (const name of ['Dijkstra', 'A*']) {
      const row = rows.find(r => r.textContent?.includes(name))!;
      expect(within(row).getByLabelText('Yes')).toBeInTheDocument();
    }
    expect(within(standings).getByLabelText('First')).toBeInTheDocument();
  });

  it('keeps 2 to 4 racers selected', () => {
    renderApp();
    fireEvent.click(button('Race'));
    const racers = within(screen.getByRole('group', { name: 'Racers' }));
    const chip = (name: string) =>
      racers.getByRole('button', { name: new RegExp(name) });
    // 3 selected by default: add one more to reach the maximum of 4.
    fireEvent.click(chip('Breadth-first'));
    expect(chip('Depth-first')).toBeDisabled();
    // Deselect down to the minimum of 2.
    fireEvent.click(chip('Breadth-first'));
    fireEvent.click(chip('Greedy'));
    expect(chip('Dijkstra')).toBeDisabled();
    expect(chip('A\\*')).toBeDisabled();
  });

  it('switching modes clears the run on screen', () => {
    renderApp();
    fireEvent.click(button('Visualize'));
    fireEvent.click(button('Race'));
    expect(snapshot().runs).toEqual([]);
  });
});

describe('Workspace: explanations', () => {
  beforeEach(setSmallViewport);

  it('highlights the pseudocode for the phase that is playing', () => {
    renderApp();
    const current = () =>
      Array.from(document.querySelectorAll('[aria-current="step"]')).map(line =>
        line.textContent?.trim()
      );
    expect(current()).toEqual([]);
    fireEvent.click(button('Visualize'));
    frames(50);
    expect(current()).toContain('while frontier is not empty:');
    playToEnd();
    expect(current()).toEqual([
      'if cell is goal:',
      'return path traced back through parent[]',
    ]);
  });
});

describe('Workspace: share links', () => {
  beforeEach(() => {
    setSmallViewport();
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  it('Share copies a link that reopens the same board and replays the run', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const first = renderApp();
    fireEvent.click(button('Build Walls'));
    playToEnd();
    fireEvent.click(button('Race'));
    const board = visualizer.exportBoard();

    fireEvent.click(button('Share'));
    await waitFor(() =>
      expect(screen.getByText('Link copied')).toBeInTheDocument()
    );
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(window.location.hash).toMatch(
      /^#v=1&b=[\w-]+&m=race&a=greedy,dijkstra,astar$/
    );

    // Opening the link (a fresh page load) restores the board exactly and
    // starts the race.
    first.unmount();
    renderApp();
    expect(visualizer.exportBoard()).toEqual(board);
    expect(snapshot().runs).toHaveLength(3);
    expect(visualizer.player.getState().playing).toBe(true);
    expect(button('Race')).toHaveAttribute('aria-pressed', 'true');
  });

  it('falls back to the address bar when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    renderApp();
    fireEvent.click(button('Share'));
    await waitFor(() =>
      expect(screen.getByText('Link is in the address bar')).toBeInTheDocument()
    );
    expect(window.location.hash).toMatch(/^#v=1&b=/);
  });

  it('opens a link pasted into the address bar while the page is open', () => {
    renderApp();
    const original = visualizer;
    const board = {
      rows: 3,
      columns: 4,
      start: 0,
      goal: 11,
      walls: Uint8Array.of(0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0),
      weights: new Uint8Array(12).fill(1),
    };
    act(() => {
      window.history.replaceState(
        null,
        '',
        '#' + encodeShare({ board, mode: 'explore', algorithms: ['dfs'] })
      );
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(visualizer).not.toBe(original);
    expect(visualizer.exportBoard()).toEqual(board);
    expect(snapshot().runs[0]).toMatchObject({ algorithm: 'dfs' });
  });

  it('reports a broken link and falls back to a fresh board', () => {
    window.history.replaceState(null, '', '/#v=1&b=not-a-board');
    renderApp();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't open the shared board"
    );
    expect(snapshot().runs).toEqual([]);
    fireEvent.click(button('Dismiss'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Workspace: 3D view', () => {
  beforeEach(setSmallViewport);

  it('switches to the lazily loaded 3D view and back', async () => {
    renderApp();
    fireEvent.click(button('3D'));
    // jsdom has no WebGL, so the lazily loaded view shows its fallback.
    expect(
      await screen.findByText(/The 3D view needs WebGL/)
    ).toBeInTheDocument();
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
    expect(screen.getByText(/switch to 2D to edit/)).toBeInTheDocument();

    fireEvent.click(button('2D'));
    expect(screen.getByRole('application')).toBeInTheDocument();
  });
});
