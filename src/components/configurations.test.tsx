import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Configuration from './configurations';

// Forces the >=20 floor in computeBoardSize, giving every test the same
// deterministic 20x20 board regardless of the real test-runner environment's
// window size.
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

function getCellById(row: number, column: number): HTMLTableCellElement {
  const cell = document.getElementById(`${row}_${column}`);
  if (!cell) throw new Error(`No cell found at ${row}_${column}`);
  return cell as HTMLTableCellElement;
}

function findAnchorCell(letter: 'S' | 'G'): HTMLTableCellElement {
  const textNode = screen.getByText(letter, { selector: 'td' });
  return textNode as HTMLTableCellElement;
}

function cellsWithClass(className: string): HTMLTableCellElement[] {
  return Array.from(document.querySelectorAll('td')).filter(td =>
    td.className.split(' ').includes(className)
  ) as HTMLTableCellElement[];
}

function rowColOf(cell: HTMLTableCellElement): { row: number; column: number } {
  const [row, column] = cell.id.split('_').map(Number);
  return { row, column };
}

// jsdom implements neither layout (getBoundingClientRect) nor hit-testing
// (document.elementFromPoint always returns null) - the app's drag tracking
// (board.tsx's handleWindowMouseMove -> cellAtPoint) depends on
// elementFromPoint to figure out which cell the pointer is over on each
// mousemove. Mocking it to return whatever cell the test says the pointer is
// "over" (ignoring the actual, meaningless-in-jsdom clientX/clientY) is the
// standard way to test elementFromPoint-driven drag logic under jsdom.
let pointTarget: Element | null = null;

function dragCell(from: HTMLTableCellElement, to: HTMLTableCellElement): void {
  fireEvent.mouseDown(from, { button: 0 });
  pointTarget = to;
  act(() => {
    window.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 1, clientY: 1 })
    );
  });
  act(() => {
    window.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, button: 0 })
    );
  });
}

function dragThroughCells(cells: HTMLTableCellElement[]): void {
  fireEvent.mouseDown(cells[0], { button: 0 });
  for (let i = 1; i < cells.length; i++) {
    pointTarget = cells[i];
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, clientX: i, clientY: i })
      );
    });
  }
  act(() => {
    window.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, button: 0 })
    );
  });
}

describe('Configuration (component/integration)', () => {
  beforeEach(() => {
    setSmallViewport();
    // jsdom doesn't implement elementFromPoint at all (not even a stub) -
    // define it outright rather than vi.spyOn, which requires the property
    // to already exist on the object.
    document.elementFromPoint = vi.fn(() => pointTarget);
  });

  afterEach(() => {
    pointTarget = null;
    vi.restoreAllMocks();
    if (vi.isFakeTimers()) vi.useRealTimers();
  });

  it('Build Walls adds wall-fill cells to the board', () => {
    vi.useFakeTimers();
    render(<Configuration />);

    fireEvent.click(screen.getByRole('button', { name: 'Build Walls' }));
    act(() => {
      vi.runAllTimers();
    });

    expect(cellsWithClass('wall-fill').length).toBeGreaterThan(0);
  });

  it('Visualize on a clean board populates stats and a path overlay', () => {
    vi.useFakeTimers();
    render(<Configuration />);

    fireEvent.click(screen.getByRole('button', { name: 'Visualize' }));
    act(() => {
      vi.runAllTimers();
    });

    const status = screen.getByRole('status');
    const [visitedText, pathLengthText, timeText] = Array.from(
      status.querySelectorAll('.font-bold')
    ).map(el => el.textContent);
    expect(Number(visitedText)).toBeGreaterThan(0);
    expect(Number(pathLengthText)).toBeGreaterThan(0);
    expect(timeText).toMatch(/ms$/);
    expect(cellsWithClass('goal-path-fill').length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Reset Path clears the path/visited overlay but leaves walls in place', () => {
    vi.useFakeTimers();
    render(<Configuration />);

    fireEvent.click(screen.getByRole('button', { name: 'Build Walls' }));
    act(() => {
      vi.runAllTimers();
    });
    const wallCountAfterBuild = cellsWithClass('wall-fill').length;
    expect(wallCountAfterBuild).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Visualize' }));
    act(() => {
      vi.runAllTimers();
    });
    expect(cellsWithClass('goal-path-fill').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Reset Path' }));

    expect(cellsWithClass('goal-path-fill').length).toBe(0);
    expect(cellsWithClass('board-fill').length).toBe(0);
    expect(cellsWithClass('wall-fill').length).toBe(wallCountAfterBuild);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('Reset All clears walls and the path/visited overlay', () => {
    vi.useFakeTimers();
    render(<Configuration />);

    fireEvent.click(screen.getByRole('button', { name: 'Build Walls' }));
    act(() => {
      vi.runAllTimers();
    });
    expect(cellsWithClass('wall-fill').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Visualize' }));
    act(() => {
      vi.runAllTimers();
    });
    expect(cellsWithClass('goal-path-fill').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Reset All' }));

    expect(cellsWithClass('wall-fill').length).toBe(0);
    expect(cellsWithClass('goal-path-fill').length).toBe(0);
    expect(cellsWithClass('board-fill').length).toBe(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('paint mode controls whether a click paints a wall or weighted terrain', () => {
    render(<Configuration />);

    fireEvent.click(screen.getByRole('button', { name: 'Weighted Terrain' }));

    // Any interactive empty cell works - grab one far from the anchors.
    const target = getCellById(10, 10);
    fireEvent.mouseDown(target, { button: 0 });
    fireEvent.mouseUp(window, { button: 0 });

    expect(target.className.split(' ')).toContain('weight-fill');
    expect(target.className.split(' ')).not.toContain('wall-fill');
  });

  it('click-and-drag paints multiple cells from one gesture', () => {
    render(<Configuration />);

    const cells = [
      getCellById(5, 5),
      getCellById(5, 6),
      getCellById(5, 7),
      getCellById(5, 8),
    ];
    dragThroughCells(cells);

    for (const cell of cells) {
      expect(cell.className.split(' ')).toContain('wall-fill');
    }
  });

  it('click-and-drag erases multiple previously-painted cells from one gesture', () => {
    render(<Configuration />);

    const cells = [getCellById(6, 5), getCellById(6, 6), getCellById(6, 7)];
    dragThroughCells(cells); // paint them first
    for (const cell of cells) {
      expect(cell.className.split(' ')).toContain('wall-fill');
    }

    dragThroughCells(cells); // second drag over already-painted cells erases

    for (const cell of cells) {
      expect(cell.className.split(' ')).not.toContain('wall-fill');
    }
  });

  it('dragging the start marker updates the actual coordinate the search algorithm uses, not just its visual position', () => {
    vi.useFakeTimers();
    render(<Configuration />);

    const goalCell = findAnchorCell('G');
    const { row: goalRow, column: goalColumn } = rowColOf(goalCell);
    // An empty cell directly adjacent to goal - if the drag only updates the
    // visual `kind` and search still uses the stale old start position, the
    // resulting path length would not be exactly 1.
    const adjacentToGoal = getCellById(goalRow + 1, goalColumn);
    expect(adjacentToGoal.className.split(' ')).not.toContain(
      'board-cell-anchor'
    );

    const startCellBefore = findAnchorCell('S');
    const { row: oldStartRow, column: oldStartColumn } =
      rowColOf(startCellBefore);

    dragCell(startCellBefore, adjacentToGoal);

    // Visual position moved.
    expect(getCellById(oldStartRow, oldStartColumn).textContent).toBe('');
    expect(findAnchorCell('S')).toBe(adjacentToGoal);

    fireEvent.click(screen.getByRole('button', { name: 'Visualize' }));
    act(() => {
      vi.runAllTimers();
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const status = screen.getByRole('status');
    // Stats grid is [visitedCount, pathLength, algorithmTime] - path.length
    // counts nodes (start + goal), so an adjacent pair is exactly 2. That
    // only holds if runVisualizeAlgorithm used the updated coordinate; the
    // stale old (far-away) start would produce a much longer path.
    const pathLengthText = status.querySelectorAll('.font-bold')[1].textContent;
    expect(pathLengthText).toBe('2');
  });

  it('dragging the goal marker updates the actual coordinate the search algorithm uses, not just its visual position', () => {
    vi.useFakeTimers();
    render(<Configuration />);

    const startCell = findAnchorCell('S');
    const { row: startRow, column: startColumn } = rowColOf(startCell);
    const adjacentToStart = getCellById(startRow - 1, startColumn);
    expect(adjacentToStart.className.split(' ')).not.toContain(
      'board-cell-anchor'
    );

    const goalCellBefore = findAnchorCell('G');
    const { row: oldGoalRow, column: oldGoalColumn } = rowColOf(goalCellBefore);

    dragCell(goalCellBefore, adjacentToStart);

    expect(getCellById(oldGoalRow, oldGoalColumn).textContent).toBe('');
    expect(findAnchorCell('G')).toBe(adjacentToStart);

    fireEvent.click(screen.getByRole('button', { name: 'Visualize' }));
    act(() => {
      vi.runAllTimers();
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const status = screen.getByRole('status');
    const pathLengthText = status.querySelectorAll('.font-bold')[1].textContent;
    expect(pathLengthText).toBe('2');
  });

  it('resetting mid-visualization cancels the in-flight animation - regression test for the reset-during-animation bug', () => {
    vi.useFakeTimers();
    render(<Configuration />);

    fireEvent.click(screen.getByRole('button', { name: 'Visualize' }));

    // Advance partway through the animation - enough for at least one
    // onCellVisited callback to have fired, but nowhere near enough for the
    // whole (400-cell) board to finish.
    act(() => {
      vi.advanceTimersByTime(30);
    });
    expect(cellsWithClass('board-fill').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Reset All' }));
    expect(cellsWithClass('board-fill').length).toBe(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Jump far past when the original run would have fully completed. If
    // reset didn't actually cancel the pending timeouts, they'd still fire
    // here and repopulate board-fill/status after the reset.
    act(() => {
      vi.advanceTimersByTime(100_000);
    });
    expect(cellsWithClass('board-fill').length).toBe(0);
    expect(cellsWithClass('goal-path-fill').length).toBe(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('resetting mid-wall-build cancels the remaining wall placements - regression test for untracked wall timers', () => {
    vi.useFakeTimers();
    render(<Configuration />);

    fireEvent.click(screen.getByRole('button', { name: 'Build Walls' }));
    act(() => {
      vi.advanceTimersByTime(30);
    });
    expect(cellsWithClass('wall-fill').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Reset All' }));
    expect(cellsWithClass('wall-fill').length).toBe(0);

    // If the wall placements weren't tracked/cancelled, they'd keep landing
    // on the freshly reset board here.
    act(() => {
      vi.advanceTimersByTime(100_000);
    });
    expect(cellsWithClass('wall-fill').length).toBe(0);
  });

  it('ignores Visualize while walls are still being built', () => {
    vi.useFakeTimers();
    render(<Configuration />);

    fireEvent.click(screen.getByRole('button', { name: 'Build Walls' }));
    act(() => {
      vi.advanceTimersByTime(30);
    });

    // Searching a half-built maze would report a path through walls that
    // are about to appear - the click must be dropped instead.
    fireEvent.click(screen.getByRole('button', { name: 'Visualize' }));
    act(() => {
      vi.advanceTimersByTime(100_000);
    });
    expect(cellsWithClass('board-fill').length).toBe(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('info dialog opens on click and closes on Escape', async () => {
    render(<Configuration />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const infoIcon = document.querySelector('.cursor-help');
    if (!infoIcon) throw new Error('info icon not found');
    fireEvent.click(infoIcon);

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
    vi.useFakeTimers();
    render(<Configuration />);

    const goalCell = findAnchorCell('G');
    const { row, column } = rowColOf(goalCell);
    // Wall in every cardinal neighbor of goal (all exist - goal is placed
    // one cell inside the border, never at row 0).
    const neighbors = [
      getCellById(row - 1, column),
      getCellById(row + 1, column),
      getCellById(row, column - 1),
      getCellById(row, column + 1),
    ];
    for (const neighbor of neighbors) {
      fireEvent.mouseDown(neighbor, { button: 0 });
      fireEvent.mouseUp(window, { button: 0 });
      expect(neighbor.className.split(' ')).toContain('wall-fill');
    }

    fireEvent.click(screen.getByRole('button', { name: 'Visualize' }));
    act(() => {
      vi.runAllTimers();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('No path was found');

    fireEvent.click(screen.getByRole('button', { name: 'Reset All' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
