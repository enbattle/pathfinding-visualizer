import {
  createGrid,
  generateMaze,
  runSearch,
  type Grid,
  type MazeAlgorithmId,
  type PathAlgorithmId,
  type Random,
} from '../engine';
import { Player, type FrameClock } from '../player/player';
import { createMazeRun, createSearchRun, type Run } from './runs';

/** Traversal cost of a weighted-terrain cell (normal cells cost 1). */
export const WEIGHTED_TERRAIN_COST = 5;

/** How long a cell's entrance animation lasts, in seconds of playback. */
export const ENTRANCE_SECONDS = 0.35;

export const NO_PATH_MESSAGE = 'No path was found. Please try again.';

export type PaintMode = 'wall' | 'weight';

export type CellKind = 'empty' | 'wall' | 'weight' | 'start' | 'goal';

export interface VisualizerSnapshot {
  /** Bumped on every change; the grid's typed arrays are mutated in place. */
  readonly version: number;
  readonly grid: Grid;
  readonly start: number;
  readonly goal: number;
  /** The run being shown (animating or finished), if any. */
  readonly run: Run | null;
  readonly error: string | null;
}

type Gesture =
  | {
      readonly kind: 'paint';
      readonly action: 'add' | 'erase';
      readonly mode: PaintMode;
    }
  | { readonly kind: 'move'; readonly anchor: 'start' | 'goal' };

export interface VisualizerOptions {
  readonly rows: number;
  readonly columns: number;
  readonly start: number;
  readonly goal: number;
  readonly clock?: FrameClock;
  /** Initial playback speed, ticks per second. */
  readonly rate?: number;
}

/** Entrance-animation length in ticks at playback speed `rate`. */
export function animationTicks(rate: number): number {
  return rate * ENTRANCE_SECONDS;
}

/**
 * The app's state and commands, independent of React and the DOM: the
 * board (walls, weights, start/goal), the run being shown, and the
 * playback `player` that animates it.
 *
 * Runs are computed in full the moment they start; playback only decides
 * how much of a run is on screen. That's why nothing here needs timers,
 * and why interrupting a run is always safe: a maze that's still animating
 * is already fully built, and a search result is already complete.
 */
export class Visualizer {
  readonly player: Player;
  private readonly grid: Grid;
  private start: number;
  private goal: number;
  private run: Run | null = null;
  private error: string | null = null;
  private gesture: Gesture | null = null;
  private snapshot: VisualizerSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor({ rows, columns, start, goal, clock, rate }: VisualizerOptions) {
    this.grid = createGrid(rows, columns);
    this.assertAnchors(start, goal);
    this.start = start;
    this.goal = goal;
    this.player = new Player({ clock, rate });
    this.snapshot = this.createSnapshot(0);
  }

  getSnapshot = (): VisualizerSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  cellKind(index: number): CellKind {
    if (index === this.start) return 'start';
    if (index === this.goal) return 'goal';
    if (this.grid.walls[index]) return 'wall';
    return this.grid.weights[index] > 1 ? 'weight' : 'empty';
  }

  // --- Runs ----------------------------------------------------------------

  /** Runs `algorithm` from start to goal and animates it from the beginning. */
  visualize(algorithm: PathAlgorithmId): void {
    this.settleMaze();
    this.startRun(this.search(algorithm), { animate: true });
  }

  /**
   * Replaces all walls with a freshly generated maze (weighted terrain is
   * kept, except where a wall lands) and animates it being built.
   */
  buildMaze(algorithm: MazeAlgorithmId, random?: Random): void {
    const { rows, columns } = this.grid;
    const placements = generateMaze(
      { rows, columns, start: this.start, goal: this.goal },
      algorithm,
      random
    );
    this.grid.walls.fill(0);
    for (const { index } of placements) {
      this.grid.walls[index] = 1;
      this.grid.weights[index] = 1;
    }
    this.error = null;
    this.startRun(createMazeRun(rows * columns, algorithm, placements), {
      animate: true,
    });
  }

  /** Clears the search/maze animation, keeping the board as it is. */
  resetPath(): void {
    this.run = null;
    this.error = null;
    this.player.clear();
    this.emit();
  }

  /** Clears walls, weights and any run, and optionally moves start/goal. */
  resetAll(anchors?: { start: number; goal: number }): void {
    if (anchors) {
      this.assertAnchors(anchors.start, anchors.goal);
      this.start = anchors.start;
      this.goal = anchors.goal;
    }
    this.grid.walls.fill(0);
    this.grid.weights.fill(1);
    this.gesture = null;
    this.resetPath();
  }

  /** Playback speed in ticks per second. */
  setRate(rate: number): void {
    this.player.setRate(rate);
    if (this.run) this.player.setLength(this.timelineLength(this.run));
  }

  // --- Editing: click/tap/keyboard gestures ----------------------------------

  /**
   * Starts a gesture on a cell: on start/goal it picks the marker up (see
   * continueGesture); anywhere else it paints (`mode`) an empty cell or
   * erases a painted one, and the rest of the gesture keeps doing whichever
   * of those it started with.
   */
  beginGesture(index: number, mode: PaintMode): void {
    this.assertCell(index);
    const kind = this.cellKind(index);
    if (kind === 'start' || kind === 'goal') {
      this.gesture = { kind: 'move', anchor: kind };
      return;
    }
    const action = kind === 'empty' ? 'add' : 'erase';
    this.gesture = { kind: 'paint', action, mode };
    this.applyGesture(index);
  }

  /** Continues the current gesture onto another cell (drag, or arrow key). */
  continueGesture(index: number): void {
    if (!this.gesture) return;
    this.assertCell(index);
    this.applyGesture(index);
  }

  endGesture(): void {
    this.gesture = null;
  }

  get gestureInProgress(): boolean {
    return this.gesture !== null;
  }

  dispose(): void {
    this.player.dispose();
    this.listeners.clear();
  }

  // --- Internals -------------------------------------------------------------

  private applyGesture(index: number): void {
    const gesture = this.gesture;
    if (!gesture) return;
    const kind = this.cellKind(index);

    if (gesture.kind === 'move') {
      // A marker can land on any cell except the other marker; landing on a
      // wall or weighted terrain clears it.
      if (kind === 'start' || kind === 'goal') return;
      this.settleMaze();
      this.grid.walls[index] = 0;
      this.grid.weights[index] = 1;
      if (gesture.anchor === 'start') this.start = index;
      else this.goal = index;
      this.afterEdit();
      return;
    }

    if (gesture.action === 'add' && kind === 'empty') {
      this.settleMaze();
      if (gesture.mode === 'wall') this.grid.walls[index] = 1;
      else this.grid.weights[index] = WEIGHTED_TERRAIN_COST;
      this.afterEdit();
    } else if (
      gesture.action === 'erase' &&
      (kind === 'wall' || kind === 'weight')
    ) {
      this.settleMaze();
      this.grid.walls[index] = 0;
      this.grid.weights[index] = 1;
      this.afterEdit();
    }
  }

  // After an edit, a search result on screen would be stale - re-run it
  // instantly (no animation) so the path follows the edit live.
  private afterEdit(): void {
    if (this.run?.kind === 'search') {
      this.startRun(this.search(this.run.algorithm), { animate: false });
    } else {
      this.emit();
    }
  }

  // A maze mid-animation is already fully built in the grid; anything that
  // changes the board or starts a search first shows the whole maze.
  private settleMaze(): void {
    if (this.run?.kind === 'maze') {
      this.run = null;
      this.player.clear();
    }
  }

  private search(algorithm: PathAlgorithmId): Run {
    const problem = { grid: this.grid, start: this.start, goal: this.goal };
    const startTime = performance.now();
    const { events, result } = runSearch(problem, algorithm);
    const searchMs = performance.now() - startTime;
    this.error = result.path ? null : NO_PATH_MESSAGE;
    return createSearchRun(
      this.grid.rows * this.grid.columns,
      algorithm,
      events,
      result,
      searchMs
    );
  }

  private startRun(run: Run, { animate }: { animate: boolean }): void {
    this.run = run;
    this.player.load(this.timelineLength(run), { autoplay: animate });
    if (!animate) this.player.finish();
    this.emit();
  }

  // The run's own ticks, plus time for the last cells' entrance animation
  // to finish before playback stops.
  private timelineLength(run: Run): number {
    return run.length + Math.ceil(animationTicks(this.player.getState().rate));
  }

  private emit(): void {
    this.snapshot = this.createSnapshot(this.snapshot.version + 1);
    for (const listener of this.listeners) listener();
  }

  private createSnapshot(version: number): VisualizerSnapshot {
    return {
      version,
      grid: this.grid,
      start: this.start,
      goal: this.goal,
      run: this.run,
      error: this.error,
    };
  }

  private assertCell(index: number): void {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.grid.walls.length
    ) {
      throw new RangeError(`${index} is not a cell of this board`);
    }
  }

  private assertAnchors(start: number, goal: number): void {
    this.assertCell(start);
    this.assertCell(goal);
    if (start === goal)
      throw new RangeError('start and goal must be different cells');
  }
}
