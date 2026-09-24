import { describe, it, expect } from 'vitest';
import { createGrid, runSearch, toIndex } from '../engine';
import {
  createMazeRun,
  createSearchRun,
  discoveredAt,
  entranceProgress,
  isRevealed,
  NEVER,
} from './runs';

describe('createSearchRun', () => {
  // 1x5 corridor, start at 0, goal at 4: discovers 1, 2, 3; path 0-1-2-3-4.
  const grid = createGrid(1, 5);
  const { events, result } = runSearch({ grid, start: 0, goal: 4 }, 'bfs');
  const run = createSearchRun(5, 'bfs', events, result, 1.5);

  it('gives discoveries ticks 0.. in order, then interior path cells', () => {
    expect([...run.discoverTick]).toEqual([NEVER, 0, 1, 2, NEVER]);
    expect([...run.pathTick]).toEqual([NEVER, 3, 4, 5, NEVER]);
    expect(run.discoveries).toBe(3);
    expect(run.length).toBe(6);
    expect(run.searchMs).toBe(1.5);
  });

  it('has no path ticks when there is no path', () => {
    const walled = createGrid(1, 3);
    walled.walls[1] = 1;
    const search = runSearch({ grid: walled, start: 0, goal: 2 }, 'bfs');
    const noPath = createSearchRun(3, 'bfs', search.events, search.result, 0);
    expect([...noPath.pathTick]).toEqual([NEVER, NEVER, NEVER]);
    expect(noPath.length).toBe(noPath.discoveries);
  });

  it('counts discovered cells visible at a playhead position', () => {
    expect(discoveredAt(run, 0)).toBe(0);
    expect(discoveredAt(run, 0.2)).toBe(1);
    expect(discoveredAt(run, 1)).toBe(1);
    expect(discoveredAt(run, 2.5)).toBe(3);
    expect(discoveredAt(run, 100)).toBe(3);
  });
});

describe('createMazeRun', () => {
  it('maps placements to ticks and ends after the last one', () => {
    const grid = createGrid(2, 3);
    const run = createMazeRun(6, 'prims', [
      { index: toIndex(grid, 0, 0), tick: 0 },
      { index: toIndex(grid, 0, 1), tick: 0 },
      { index: toIndex(grid, 1, 2), tick: 4 },
    ]);
    expect([...run.wallTick]).toEqual([0, 0, NEVER, NEVER, NEVER, 4]);
    expect(run.length).toBe(5);
  });
});

describe('isRevealed / entranceProgress', () => {
  it('reveals a cell strictly after its tick', () => {
    expect(isRevealed(3, 3)).toBe(false);
    expect(isRevealed(3, 3.01)).toBe(true);
    expect(isRevealed(NEVER, 1000)).toBe(false);
  });

  it('runs entrance progress from 0 to 1 over the animation length', () => {
    expect(entranceProgress(2, 2, 4)).toBe(0);
    expect(entranceProgress(2, 4, 4)).toBe(0.5);
    expect(entranceProgress(2, 10, 4)).toBe(1);
    expect(entranceProgress(2, 3, 0)).toBe(1);
    expect(entranceProgress(NEVER, 3, 4)).toBe(0);
  });
});
