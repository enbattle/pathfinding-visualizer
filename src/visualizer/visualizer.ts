import {
  createGrid,
  generateMaze,
  runSearch,
  type Grid,
  type MazeAlgorithmId,
  type PathAlgorithmId,
  type Random,
  WEIGHTED_TERRAIN_COST,
} from '../engine';

// Re-exported for the UI and tests; defined in the engine (grid.ts).
export { WEIGHTED_TERRAIN_COST };
import { Player, type FrameClock } from '../player/player';
import {
  createMazeRun,
  createSearchRun,
  type Run,
  type SearchRun,
} from './runs';

/** Most algorithms a race can compare at once. */
export const MAX_RACERS = 4;

/** How long a cell's entrance animation lasts, in seconds of playback. */
const ENTRANCE_SECONDS = 0.35;

export const NO_PATH_MESSAGE = 'No path was found. Please try again.';

export type PaintMode = 'wall' | 'weight';

export type CellKind = 'empty' | 'wall' | 'weight' | 'start' | 'goal';

export interface VisualizerSnapshot {
  /** Bumped on every change; the grid's typed arrays are mutated in place. */
  readonly version: number;
  readonly grid: Grid;
  readonly start: number;
  readonly goal: number;
  /**
   * The runs on screen, animating or finished: none; one search or maze
   * build; or, in a race, one search per algorithm, played in lockstep.
   */
  readonly runs: readonly Run[];
  /**
   * Lowest possible path cost on the current board (Infinity when the goal
   * is unreachable), computed whenever searches are shown so their results
   * can be judged; null otherwise.
   */
  readonly bestCost: number | null;
  readonly error: string | null;
  /**
   * Bumped whenever the board itself (walls, weights, start/goal) changes -
   * not when runs start or play. Lets the UI tell when a share link in the
   * URL no longer describes what's on screen.
   */
  readonly boardRevision: number;
}

/** The runs in a snapshot that are searches (all of them, or none). */
export function searchRuns(snapshot: VisualizerSnapshot): readonly SearchRun[] {
  return snapshot.runs.filter((run): run is SearchRun => run.kind === 'search');
}

/** A board as plain data, e.g. for sharing. */
export interface BoardData {
  readonly rows: number;
  readonly columns: number;
  readonly start: number;
  readonly goal: number;
  readonly walls: Uint8Array;
  readonly weights: Uint8Array;
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
  /** Initial walls (0/1) and weights (entry costs), one per cell. */
  readonly walls?: Uint8Array;
  readonly weights?: Uint8Array;
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
  private runs: readonly Run[] = [];
  private bestCost: number | null = null;
  private boardRevision = 0;
  private error: string | null = null;
  private gesture: Gesture | null = null;
  // While a marker is being dragged: the cell it is over and what that cell
  // held before the marker arrived, restored when the marker moves on.
  private covered: { index: number; wall: number; weight: number } | null =
    null;
  private snapshot: VisualizerSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor({
    rows,
    columns,
    start,
    goal,
    walls,
    weights,
    clock,
    rate,
  }: VisualizerOptions) {
    this.grid = createGrid(rows, columns);
    this.assertAnchors(start, goal);
    const size = rows * columns;
    if (walls) {
      if (walls.length !== size) {
        throw new RangeError('walls must have one entry per cell');
      }
      for (let i = 0; i < size; i++) this.grid.walls[i] = walls[i] ? 1 : 0;
    }
    if (weights) {
      if (weights.length !== size) {
        throw new RangeError('weights must have one entry per cell');
      }
      for (let i = 0; i < size; i++) {
        if (weights[i] < 1) throw new RangeError('weights must be >= 1');
        this.grid.weights[i] = weights[i];
      }
    }
    this.start = start;
    this.goal = goal;
    // Markers always sit on plain terrain.
    for (const anchor of [start, goal]) {
      this.grid.walls[anchor] = 0;
      this.grid.weights[anchor] = 1;
    }
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
    this.race([algorithm]);
  }

  /**
   * Runs several algorithms on the same board and animates them side by
   * side in lockstep: each playback tick advances every run by one step.
   */
  race(algorithms: readonly PathAlgorithmId[]): void {
    if (algorithms.length < 1 || algorithms.length > MAX_RACERS) {
      throw new RangeError('a race needs 1 to ' + MAX_RACERS + ' algorithms');
    }
    if (new Set(algorithms).size !== algorithms.length) {
      throw new RangeError('race algorithms must be distinct');
    }
    this.settleMaze();
    this.showSearches(algorithms, { animate: true });
  }

  /** The board as plain data (copies), e.g. for a share link. */
  exportBoard(): BoardData {
    const { rows, columns, walls, weights } = this.grid;
    return {
      rows,
      columns,
      start: this.start,
      goal: this.goal,
      walls: walls.slice(),
      weights: weights.slice(),
    };
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
    // The maze replaces every wall, so there is nothing to restore under a
    // marker that happens to be mid-drag.
    this.covered = null;
    for (const { index } of placements) {
      this.grid.walls[index] = 1;
      this.grid.weights[index] = 1;
    }
    this.error = null;
    this.bestCost = null;
    this.boardRevision++;
    this.startRuns([createMazeRun(rows * columns, algorithm, placements)], {
      animate: true,
    });
  }

  /** Clears the search/maze animation, keeping the board as it is. */
  resetPath(): void {
    this.runs = [];
    this.bestCost = null;
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
    this.boardRevision++;
    this.gesture = null;
    this.covered = null;
    this.resetPath();
  }

  /** Playback speed in ticks per second. */
  setRate(rate: number): void {
    this.player.setRate(rate);
    if (this.runs.length > 0) {
      this.player.setLength(this.timelineLength(this.runs));
    }
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
    // Dropping a marker commits it: the cell it covers stays plain.
    this.gesture = null;
    this.covered = null;
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
      // A marker can move onto any cell except the other marker. It only
      // covers the cell under it: passing over a wall or weighted terrain
      // puts it back once the marker moves on, and only the cell it's
      // finally dropped on is cleared.
      if (kind === 'start' || kind === 'goal') return;
      this.settleMaze();
      if (this.covered) {
        this.grid.walls[this.covered.index] = this.covered.wall;
        this.grid.weights[this.covered.index] = this.covered.weight;
      }
      this.covered = {
        index,
        wall: this.grid.walls[index],
        weight: this.grid.weights[index],
      };
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

  // After an edit, search results on screen would be stale - re-run them
  // instantly (no animation) so the paths follow the edit live.
  private afterEdit(): void {
    this.boardRevision++;
    const algorithms = this.runs
      .filter((run): run is SearchRun => run.kind === 'search')
      .map(run => run.algorithm);
    if (algorithms.length > 0) {
      this.showSearches(algorithms, { animate: false });
    } else {
      this.emit();
    }
  }

  // A maze mid-animation is already fully built in the grid; anything that
  // changes the board or starts a search first shows the whole maze.
  private settleMaze(): void {
    if (this.runs.some(run => run.kind === 'maze')) {
      this.runs = [];
      this.player.clear();
    }
  }

  private showSearches(
    algorithms: readonly PathAlgorithmId[],
    { animate }: { animate: boolean }
  ): void {
    const runs = algorithms.map(algorithm => this.search(algorithm));
    // Every algorithm agrees on whether the goal is reachable.
    this.error = runs[0].result.path ? null : NO_PATH_MESSAGE;
    const dijkstra = runs.find(run => run.algorithm === 'dijkstra');
    const problem = { grid: this.grid, start: this.start, goal: this.goal };
    this.bestCost = (dijkstra ?? runSearch(problem, 'dijkstra')).result.cost;
    this.startRuns(runs, { animate });
  }

  private search(algorithm: PathAlgorithmId): SearchRun {
    const problem = { grid: this.grid, start: this.start, goal: this.goal };
    const startTime = performance.now();
    const { events, result } = runSearch(problem, algorithm);
    const searchMs = performance.now() - startTime;
    return createSearchRun(
      this.grid.rows * this.grid.columns,
      algorithm,
      events,
      result,
      searchMs
    );
  }

  private startRuns(
    runs: readonly Run[],
    { animate }: { animate: boolean }
  ): void {
    this.runs = runs;
    this.player.load(this.timelineLength(runs), { autoplay: animate });
    if (!animate) this.player.finish();
    this.emit();
  }

  // The longest run's ticks, plus time for the last cells' entrance
  // animation to finish before playback stops.
  private timelineLength(runs: readonly Run[]): number {
    const longest = Math.max(0, ...runs.map(run => run.length));
    return longest + Math.ceil(animationTicks(this.player.getState().rate));
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
      runs: this.runs,
      bestCost: this.bestCost,
      boardRevision: this.boardRevision,
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
