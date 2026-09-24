import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { runSearch, seededRandom } from '../engine';
import { FakeClock } from '../test-support/fake-clock';
import { decodeShare, encodeShare } from './share';
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
      const {
        runs: [run = null],
        error,
      } = visualizer.getSnapshot();
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
      expect(visualizer.getSnapshot().runs[0]).toMatchObject({
        algorithm: 'dfs',
      });
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
      const {
        grid,
        runs: [run = null],
      } = visualizer.getSnapshot();
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
      const {
        grid,
        runs: [run = null],
      } = visualizer.getSnapshot();
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
      expect(snapshot.runs).toEqual([]);
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
      expect(snapshot).toMatchObject({ start: 0, goal: 34, runs: [] });
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

    it('a dragged marker passes over walls and weights without erasing them', () => {
      const { visualizer } = create();
      for (const [cell, mode] of [
        [at(2, 2), 'wall'],
        [at(2, 3), 'weight'],
      ] as const) {
        visualizer.beginGesture(cell, mode);
        visualizer.endGesture();
      }
      // Drag S right across the wall and the weight, then drop past them.
      visualizer.beginGesture(START, 'wall');
      visualizer.continueGesture(at(2, 2));
      expect(visualizer.cellKind(at(2, 2))).toBe('start'); // covered for now
      visualizer.continueGesture(at(2, 3));
      visualizer.continueGesture(at(2, 4));
      visualizer.endGesture();
      expect(visualizer.cellKind(at(2, 2))).toBe('wall');
      expect(visualizer.cellKind(at(2, 3))).toBe('weight');
      expect(visualizer.getSnapshot().grid.weights[at(2, 3)]).toBe(
        WEIGHTED_TERRAIN_COST
      );
      expect(visualizer.getSnapshot().start).toBe(at(2, 4));
    });

    it('dropping a marker onto a wall replaces the wall', () => {
      const { visualizer } = create();
      visualizer.beginGesture(at(2, 2), 'wall');
      visualizer.endGesture();
      visualizer.beginGesture(START, 'wall');
      visualizer.continueGesture(at(2, 2));
      visualizer.endGesture();
      // Moving the marker on later leaves plain floor, not the old wall.
      visualizer.beginGesture(at(2, 2), 'wall');
      visualizer.continueGesture(at(2, 1));
      visualizer.endGesture();
      expect(visualizer.cellKind(at(2, 2))).toBe('empty');
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
      const {
        runs: [run = null],
        grid,
      } = visualizer.getSnapshot();
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
      expect(visualizer.getSnapshot().runs).toEqual([]);
      expect(visualizer.player.getState().length).toBe(0);
    });
  });

  it('keeps the timeline covering the final animation when the speed changes', () => {
    const { visualizer } = create();
    visualizer.visualize('bfs');
    const runLength = visualizer.getSnapshot().runs[0].length;
    visualizer.setRate(400);
    expect(visualizer.player.getState().length).toBe(
      runLength + Math.ceil(400 * 0.35)
    );
  });

  it('bumps boardRevision for board changes only, not for runs', () => {
    const { visualizer, clock } = create();
    const revision = () => visualizer.getSnapshot().boardRevision;
    const initial = revision();
    visualizer.visualize('bfs');
    clock.runUntilIdle();
    visualizer.resetPath();
    expect(revision()).toBe(initial);

    visualizer.beginGesture(at(0, 0), 'wall');
    visualizer.endGesture();
    expect(revision()).toBe(initial + 1);
    visualizer.buildMaze('prims', seededRandom(1));
    expect(revision()).toBe(initial + 2);
    visualizer.resetAll();
    expect(revision()).toBe(initial + 3);
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
      fc.record({
        type: fc.constant('race' as const),
        algorithms: fc.shuffledSubarray(
          ['bfs', 'dfs', 'greedy', 'dijkstra', 'astar'] as const,
          { minLength: 2, maxLength: 4 }
        ),
      }),
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
          else if (c.type === 'race') visualizer.race(c.algorithms);
          else if (c.type === 'maze')
            visualizer.buildMaze('recursive-division', seededRandom(c.seed));
          else if (c.type === 'frames') clock.advance(c.ms);
          else if (c.type === 'resetPath') visualizer.resetPath();
          else visualizer.resetAll();

          const { grid, start, goal, runs } = visualizer.getSnapshot();
          expect(start).not.toBe(goal);
          expect(grid.walls[start] + grid.walls[goal]).toBe(0);
          expect(grid.weights[start] + grid.weights[goal]).toBe(2);
          for (const run of runs) {
            if (run.kind !== 'search') continue;
            const fresh = runSearch({ grid, start, goal }, run.algorithm);
            expect(run.result).toEqual(fresh.result);
          }
          const player = visualizer.player.getState();
          expect(player.tick).toBeGreaterThanOrEqual(0);
          expect(player.tick).toBeLessThanOrEqual(player.length);
          if (runs.length === 0) expect(player.length).toBe(0);
        }
      }),
      { numRuns: 300 }
    );
  });

  describe('race', () => {
    it('runs every algorithm on the same board, in lockstep on one timeline', () => {
      const { visualizer } = create();
      visualizer.race(['bfs', 'astar', 'greedy']);
      const snapshot = visualizer.getSnapshot();
      expect(snapshot.runs.map(run => run.kind)).toEqual([
        'search',
        'search',
        'search',
      ]);
      expect(
        snapshot.runs.map(run => run.kind === 'search' && run.algorithm)
      ).toEqual(['bfs', 'astar', 'greedy']);
      // One timeline, long enough for the slowest racer.
      const longest = Math.max(...snapshot.runs.map(run => run.length));
      expect(visualizer.player.getState().length).toBe(
        longest + Math.ceil(100 * 0.35)
      );
    });

    it('rejects too few, too many, or repeated racers', () => {
      const { visualizer } = create();
      expect(() => visualizer.race([])).toThrow(RangeError);
      expect(() =>
        visualizer.race(['bfs', 'dfs', 'greedy', 'dijkstra', 'astar'])
      ).toThrow(RangeError);
      expect(() => visualizer.race(['bfs', 'bfs'])).toThrow(RangeError);
    });

    it('re-runs every racer live when the board is edited', () => {
      const { visualizer } = create();
      visualizer.race(['dijkstra', 'dfs']);
      visualizer.beginGesture(at(2, 3), 'wall');
      visualizer.endGesture();
      const { grid, runs } = visualizer.getSnapshot();
      expect(runs).toHaveLength(2);
      for (const run of runs) {
        if (run.kind !== 'search') throw new Error('expected searches');
        const fresh = runSearch(
          { grid, start: START, goal: GOAL },
          run.algorithm
        );
        expect(run.result).toEqual(fresh.result);
      }
    });
  });

  describe('bestCost', () => {
    it('is the lowest possible path cost whenever searches are shown', () => {
      const { visualizer } = create();
      expect(visualizer.getSnapshot().bestCost).toBeNull();
      visualizer.beginGesture(at(2, 3), 'weight');
      visualizer.endGesture();
      visualizer.visualize('bfs'); // BFS walks through the weight...
      const { runs, bestCost } = visualizer.getSnapshot();
      const bfs = runs[0];
      if (bfs.kind !== 'search') throw new Error('expected a search');
      // ...but a detour avoiding it is cheaper.
      expect(bestCost).toBe(6);
      expect(bfs.result.cost).toBe(8);
      visualizer.resetPath();
      expect(visualizer.getSnapshot().bestCost).toBeNull();
    });

    it('is Infinity when the goal is unreachable', () => {
      const { visualizer } = create();
      for (const cell of [at(1, 5), at(3, 5), at(2, 4), at(2, 6)]) {
        visualizer.beginGesture(cell, 'wall');
        visualizer.endGesture();
      }
      visualizer.visualize('astar');
      expect(visualizer.getSnapshot().bestCost).toBe(Infinity);
    });
  });

  describe('board import/export', () => {
    it('round-trips a board through exportBoard and the constructor', () => {
      const { visualizer } = create();
      visualizer.buildMaze('prims', seededRandom(9));
      visualizer.beginGesture(at(0, 0), 'weight');
      visualizer.endGesture();
      const board = visualizer.exportBoard();
      const copy = new Visualizer({ ...board, clock: new FakeClock() });
      expect(copy.exportBoard()).toEqual(board);
      // Exported arrays are copies.
      board.walls.fill(1);
      expect(visualizer.getSnapshot().grid.walls.some(w => w === 0)).toBe(true);
    });

    it('rejects wrongly sized or invalid initial cells, and clears the markers', () => {
      const base = {
        rows: 2,
        columns: 2,
        start: 0,
        goal: 3,
        clock: new FakeClock(),
      };
      expect(
        () => new Visualizer({ ...base, walls: new Uint8Array(3) })
      ).toThrow(RangeError);
      expect(
        () => new Visualizer({ ...base, weights: new Uint8Array(4) })
      ).toThrow(RangeError);
      const visualizer = new Visualizer({
        ...base,
        walls: Uint8Array.of(1, 1, 0, 1),
        weights: Uint8Array.of(5, 1, 5, 5),
      });
      expect(visualizer.cellKind(0)).toBe('start');
      expect(visualizer.cellKind(3)).toBe('goal');
      expect(visualizer.cellKind(1)).toBe('wall');
      expect(visualizer.cellKind(2)).toBe('weight');
      expect(visualizer.getSnapshot().grid.weights[0]).toBe(1);
    });
  });
});

describe('sharing a board', () => {
  it('survives a share link round trip exactly, weights included', () => {
    const { visualizer } = create();
    visualizer.buildMaze('recursive-division', seededRandom(4));
    const empty = Array.from(
      { length: ROWS * COLUMNS },
      (_, cell) => cell
    ).find(cell => visualizer.cellKind(cell) === 'empty')!;
    visualizer.beginGesture(empty, 'weight');
    visualizer.endGesture();
    const board = visualizer.exportBoard();
    const decoded = decodeShare(
      encodeShare({ board, mode: 'race', algorithms: ['bfs', 'astar'] })
    );
    if (!decoded.ok) throw new Error(decoded.error);
    // The codec stores "weighted" as one bit; decoding must restore the
    // app's weighted-terrain cost, not some other value.
    expect(decoded.state.board.weights[empty]).toBe(WEIGHTED_TERRAIN_COST);
    const copy = new Visualizer({
      ...decoded.state.board,
      clock: new FakeClock(),
    });
    expect(copy.exportBoard()).toEqual(board);
  });
});
