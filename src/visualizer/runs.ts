import type {
  MazeAlgorithmId,
  PathAlgorithmId,
  SearchEvent,
  SearchResult,
  WallPlacement,
} from '../engine';

/** A cell that never appears during a run. */
export const NEVER = -1;

/**
 * An animated run, reduced to *when* each cell appears: `revealTick[i]` is
 * the tick at which cell `i` shows up (NEVER if it doesn't). A cell is
 * visible at playhead `t` once `revealTick < t`. Because it's plain data,
 * the board can be drawn at any playhead position - forwards, backwards or
 * mid-scrub - without replaying anything.
 */
export interface SearchRun {
  readonly kind: 'search';
  readonly algorithm: PathAlgorithmId;
  /** When each cell is discovered. */
  readonly discoverTick: Int32Array;
  /** When each interior path cell is drawn (after every discovery). */
  readonly pathTick: Int32Array;
  readonly result: SearchResult;
  /** Number of discovered cells (the first `discoveries` ticks). */
  readonly discoveries: number;
  /** Ticks until the last cell appears. */
  readonly length: number;
  /** How long the search itself took, in milliseconds. */
  readonly searchMs: number;
}

export interface MazeRun {
  readonly kind: 'maze';
  readonly algorithm: MazeAlgorithmId;
  /** When each wall appears. */
  readonly wallTick: Int32Array;
  readonly length: number;
}

export type Run = SearchRun | MazeRun;

export function createSearchRun(
  size: number,
  algorithm: PathAlgorithmId,
  events: readonly SearchEvent[],
  result: SearchResult,
  searchMs: number
): SearchRun {
  const discoverTick = new Int32Array(size).fill(NEVER);
  let discoveries = 0;
  for (const event of events) {
    if (event.type === 'discover') discoverTick[event.index] = discoveries++;
  }

  // The path draws cell by cell after the last discovery; start and goal
  // are markers, so only interior cells get a tick.
  const pathTick = new Int32Array(size).fill(NEVER);
  const path = result.path ?? [];
  for (let i = 1; i < path.length - 1; i++) {
    pathTick[path[i]] = discoveries + i - 1;
  }
  const interiorPathCells = Math.max(0, path.length - 2);

  return {
    kind: 'search',
    algorithm,
    discoverTick,
    pathTick,
    result,
    discoveries,
    length: discoveries + interiorPathCells,
    searchMs,
  };
}

export function createMazeRun(
  size: number,
  algorithm: MazeAlgorithmId,
  placements: readonly WallPlacement[]
): MazeRun {
  const wallTick = new Int32Array(size).fill(NEVER);
  let length = 0;
  for (const { index, tick } of placements) {
    wallTick[index] = tick;
    length = Math.max(length, tick + 1);
  }
  return { kind: 'maze', algorithm, wallTick, length };
}

/** Is a cell with this reveal tick visible at playhead `tick`? */
export function isRevealed(revealTick: number, tick: number): boolean {
  return revealTick !== NEVER && revealTick < tick;
}

/**
 * How far into its entrance animation a cell is, from 0 (just appeared) to
 * 1 (settled), when entrances last `animationTicks` ticks.
 */
export function entranceProgress(
  revealTick: number,
  tick: number,
  animationTicks: number
): number {
  if (!isRevealed(revealTick, tick)) return 0;
  if (animationTicks <= 0) return 1;
  return Math.min(1, (tick - revealTick) / animationTicks);
}

/** Discovered cells visible at playhead `tick` (the live "Nodes visited" count). */
export function discoveredAt(run: SearchRun, tick: number): number {
  return Math.max(0, Math.min(run.discoveries, Math.ceil(tick)));
}

/**
 * Which part of a search run is playing at `tick`:
 * - `explore`: cells are still being discovered;
 * - `path`: the found path is being traced;
 * - `found` / `unreachable`: the run has finished.
 */
export type RunPhase = 'explore' | 'path' | 'found' | 'unreachable';

export function runPhase(run: SearchRun, tick: number): RunPhase {
  if (tick < run.discoveries) return 'explore';
  if (!run.result.path) return 'unreachable';
  return tick < run.length ? 'path' : 'found';
}

/** Whether the search itself has finished by `tick` (tracing the path is just the replay). */
export function searchFinished(run: SearchRun, tick: number): boolean {
  return tick >= run.discoveries;
}
