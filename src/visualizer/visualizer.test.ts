import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { runSearch, seededRandom } from '../engine';
import { FakeClock } from '../test-support/fake-clock';
import {
  NO_PATH_MESSAGE,
  Visualizer,
  WEIGHTED_TERRAIN_COST,
} from './visualizer';

// 5x7 board, start (2,1) = 15, goal (2,5) = 19.
const ROWS = 5;
const COLUMNS = 7;
const START = 15;
const GOAL = 19;

function create(): { visualizer: Visualizer; clock: FakeClock } {
  const clock = new FakeClock();
  const visualizer = new Visualizer({
    rows: ROWS,
    columns: COLUMNS,
    start: START,
    goal: GOAL,
    clock,
    rate: 100,
  });
  return { visualizer, clock };
}

const at = (row: number, column: number) => row * COLUMNS + column;

describe('Visualizer', () => {
  it('rejects invalid anchors', () => {
    const clock = new FakeClock();
    expect(
      () => new Visualizer({ rows: 3, columns: 3, start: 4, goal: 4, clock })
    ).toThrow(RangeError);
    expect(
      () => new Visualizer({ rows: 3, columns: 3, start: 0, goal: 9, clock })
    ).toThrow(RangeError);
  });

  describe('visualize', () => {
    it('runs the search and plays it from the start', () => {
      const { visualizer } = create();
      visualizer.visualize('bfs');
      const { run, error } = visualizer.getSnapshot();
      expect(run?.kind).toBe('search');
      expect(error).toBeNull();
      const player = visualizer.player.getState();
      expect(player.tick).toBe(0);
      expect(player.playing).toBe(true);
      // Timeline = run + time for the last entrance animation.
      expect(player.length).toBeGreaterThan(run!.length);
    });

    it('plays to the end and stops', () => {
      const { visualizer, clock } = create();
      visualizer.visualize('astar');
      clock.runUntilIdle();
      const player = visualizer.player.getState();
      expect(player.playing).toBe(false);
      expect(player.tick).toBe(player.length);
    });

    it('reports when there is no path', () => {
      const { visualizer } = create();
      for (const cell of [at(1, 5), at(3, 5), at(2, 4), at(2, 6)]) {
        visualizer.beginGesture(cell, 'wall');
        visualizer.endGesture();
      }
      visualizer.visualize('dijkstra');
      expect(visualizer.getSnapshot().error).toBe(NO_PATH_MESSAGE);
    });

    it('can be run again to replay', () => {
      const { visualizer, clock } = create();
      visualizer.visualize('bfs');
      clock.runUntilIdle();
      visualizer.visualize('dfs');
      expect(visualizer.getSnapshot().run).toMatchObject({ algorithm: 'dfs' });
      expect(visualizer.player.getState()).toMatchObject({
        tick: 0,
        playing: true,
      });
    });
  });

  describe('buildMaze', () => {
    it('replaces existing walls, keeps weights, and never walls start/goal', () => {
      const { visualizer } = create();
      visualizer.beginGesture(at(0, 3), 'wall');
      visualizer.endGesture();
      visualizer.beginGesture(at(3, 3), 'weight');
      visualizer.endGesture();

      visualizer.buildMaze('prims', seededRandom(1));
      const { grid, run } = visualizer.getSnapshot();
      expect(run?.kind).toBe('maze');
      expect(grid.walls[START]).toBe(0);
      expect(grid.walls[GOAL]).toBe(0);
      // Every wall comes from this maze (the painted one isn't kept unless
      // the maze also walls that cell).
      const mazeRun = run as Extract<typeof run, { kind: 'maze' }>;
      for (let i = 0; i < grid.walls.length; i++) {
        expect(grid.walls[i] === 1).toBe(mazeRun.wallTick[i] !== -1);
      }
      // Weighted terrain survives unless a wall landed on it.
      if (!grid.walls[at(3, 3)]) {
        expect(grid.weights[at(3, 3)]).toBe(WEIGHTED_TERRAIN_COST);
      }
    });

    it('a search started mid-build searches the whole maze', () => {
      const { visualizer, clock } = create();
      visualizer.buildMaze('recursive-division', seededRandom(7));
      clock.advance(50); // part-way through the build animation
      visualizer.visualize('bfs');
      const { grid, run } = visualizer.getSnapshot();
      const expected = runSearch({ grid, start: START, goal: GOAL }, 'bfs');
      expect(run?.kind === 'search' && run.result).toEqual(expected.result);
    });
  });

  describe('resets', () => {
    it('resetPath clears the run but keeps the board', () => {
      const { visualizer } = create();
      visualizer.buildMaze('prims', seededRandom(3));
      const walls = [...visualizer.getSnapshot().grid.walls];
      visualizer.visualize('bfs');
      visualizer.resetPath();
      const snapshot = visualizer.getSnapshot();
      expect(snapshot.run).toBeNull();
      expect(snapshot.error).toBeNull();
      expect([...snapshot.grid.walls]).toEqual(walls);
      expect(visualizer.player.getState()).toMatchObject({
        length: 0,
        playing: false,
      });
    });

    it('resetAll clears walls/weights, stops playback, and can move the anchors', () => {
      const { visualizer, clock } = create();
      visualizer.buildMaze('recursive-division', seededRandom(3));
      clock.advance(30);
      visualizer.resetAll({ start: 0, goal: 34 });
      const snapshot = visualizer.getSnapshot();
      expect(snapshot.grid.walls.every(wall => wall === 0)).toBe(true);
      expect(snapshot.grid.weights.every(weight => weight === 1)).toBe(true);
      expect(snapshot).toMatchObject({ start: 0, goal: 34, run: null });
      expect(clock.pendingFrames).toBe(0);
    });
  });

  describe('gestures', () => {
    it('paints with the chosen mode, then keeps adding along the drag', () => {
      const { visualizer } = create();
      visualizer.beginGesture(at(0, 0), 'weight');
      visualizer.continueGesture(at(0, 1));
      visualizer.continueGesture(START); // anchors are never painted
      visualizer.endGesture();
      expect(visualizer.cellKind(at(0, 0))).toBe('weight');
      expect(visualizer.cellKind(at(0, 1))).toBe('weight');
      expect(visualizer.cellKind(START)).toBe('start');
    });

    it('a drag that starts on a painted cell erases instead', () => {
      const { visualizer } = create();
      visualizer.beginGesture(at(0, 0), 'wall');
      visualizer.continueGesture(at(0, 1));
      visualizer.endGesture();
      visualizer.beginGesture(at(0, 1), 'wall');
      visualizer.continueGesture(at(0, 0));
      visualizer.continueGesture(at(0, 2)); // empty: an erase drag skips it
      visualizer.endGesture();
      expect(visualizer.cellKind(at(0, 0))).toBe('empty');
      expect(visualizer.cellKind(at(0, 1))).toBe('empty');
      expect(visualizer.cellKind(at(0, 2))).toBe('empty');
    });

    it('drags a marker, clearing what it lands on but never onto the other marker', () => {
      const { visualizer } = create();
      visualizer.beginGesture(at(0, 2), 'wall');
      visualizer.endGesture();
      visualizer.beginGesture(START, 'wall');
      visualizer.continueGesture(at(0, 2));
      visualizer.continueGesture(GOAL);
      visualizer.endGesture();
      const snapshot = visualizer.getSnapshot();
      expect(snapshot.start).toBe(at(0, 2));
      expect(snapshot.goal).toBe(GOAL);
      expect(visualizer.cellKind(at(0, 2))).toBe('start');
      expect(visualizer.cellKind(START)).toBe('empty');
    });

    it('continueGesture without a gesture does nothing', () => {
      const { visualizer } = create();
      const before = visualizer.getSnapshot();
      visualizer.continueGesture(at(0, 0));
      expect(visualizer.getSnapshot()).toBe(before);
    });

    it('editing while a search is shown re-runs it instantly, without animating', () => {
      const { visualizer, clock } = create();
      visualizer.visualize('bfs');
      clock.advance(40);
      visualizer.beginGesture(GOAL, 'wall');
      visualizer.continueGesture(at(0, 6));
      visualizer.endGesture();
      const { run, grid } = visualizer.getSnapshot();
      const expected = runSearch({ grid, start: START, goal: at(0, 6) }, 'bfs');
      expect(run?.kind === 'search' && run.result).toEqual(expected.result);
      const player = visualizer.player.getState();
      expect(player.playing).toBe(false);
      expect(player.tick).toBe(player.length);
    });

    it('editing during a maze build shows the finished maze', () => {
      const { visualizer, clock } = create();
      visualizer.buildMaze('prims', seededRandom(5));
      clock.advance(30);
      visualizer.beginGesture(at(0, 0), 'weight');
      visualizer.endGesture();
      expect(visualizer.getSnapshot().run).toBeNull();
      expect(visualizer.player.getState().length).toBe(0);
    });
  });

  it('keeps the timeline covering the final animation when the speed changes', () => {
    const { visualizer } = create();
    visualizer.visualize('bfs');
    const runLength = visualizer.getSnapshot().run!.length;
    visualizer.setRate(400);
    expect(visualizer.player.getState().length).toBe(
      runLength + Math.ceil(400 * 0.35)
    );
  });

  it('notifies subscribers with a new snapshot on every change', () => {
    const { visualizer } = create();
    const versions: number[] = [];
    const unsubscribe = visualizer.subscribe(() =>
      versions.push(visualizer.getSnapshot().version)
    );
    visualizer.beginGesture(at(0, 0), 'wall');
    visualizer.endGesture();
    visualizer.visualize('bfs');
    unsubscribe();
    visualizer.resetPath();
    expect(versions).toEqual([1, 2]);
  });

  // Any mix of edits, runs and resets leaves a consistent board, and a
  // search on screen always matches a fresh search of the current board.
  it('stays consistent under any sequence of commands', () => {
    const size = ROWS * COLUMNS;
    const command = fc.oneof(
      fc.record({
        type: fc.constant('drag' as const),
        cells: fc.array(fc.integer({ min: 0, max: size - 1 }), {
          minLength: 1,
          maxLength: 6,
        }),
        mode: fc.constantFrom('wall' as const, 'weight' as const),
      }),
      fc.record({
        type: fc.constant('visualize' as const),
        algorithm: fc.constantFrom(
          'bfs' as const,
          'dfs' as const,
          'greedy' as const,
          'dijkstra' as const,
          'astar' as const
        ),
      }),
      fc.record({ type: fc.constant('maze' as const), seed: fc.integer() }),
      fc.record({ type: fc.constant('frames' as const), ms: fc.nat(200) }),
      fc.constant({ type: 'resetPath' as const }),
      fc.constant({ type: 'resetAll' as const })
    );

    fc.assert(
      fc.property(fc.array(command, { maxLength: 25 }), commands => {
        const { visualizer, clock } = create();
        for (const c of commands) {
          if (c.type === 'drag') {
            visualizer.beginGesture(c.cells[0], c.mode);
            for (const cell of c.cells.slice(1))
              visualizer.continueGesture(cell);
            visualizer.endGesture();
          } else if (c.type === 'visualize') visualizer.visualize(c.algorithm);
          else if (c.type === 'maze')
            visualizer.buildMaze('recursive-division', seededRandom(c.seed));
          else if (c.type === 'frames') clock.advance(c.ms);
          else if (c.type === 'resetPath') visualizer.resetPath();
          else visualizer.resetAll();

          const { grid, start, goal, run } = visualizer.getSnapshot();
          expect(start).not.toBe(goal);
          expect(grid.walls[start] + grid.walls[goal]).toBe(0);
          expect(grid.weights[start] + grid.weights[goal]).toBe(2);
          if (run?.kind === 'search') {
            const fresh = runSearch({ grid, start, goal }, run.algorithm);
            expect(run.result).toEqual(fresh.result);
          }
          const player = visualizer.player.getState();
          expect(player.tick).toBeGreaterThanOrEqual(0);
          expect(player.tick).toBeLessThanOrEqual(player.length);
          if (!run) expect(player.length).toBe(0);
        }
      }),
      { numRuns: 300 }
    );
  });
});
