import { neighbors, type Grid } from './grid';
import { MinHeap, Queue, Stack } from './collections';
import { euclidean, manhattan, type Heuristic } from './heuristics';

export type PathAlgorithmId = 'bfs' | 'dfs' | 'greedy' | 'dijkstra' | 'astar';

/**
 * - `always`: always returns a lowest-cost path (weighted terrain included).
 * - `unweighted`: fewest steps, but blind to terrain weight.
 * - `never`: returns *a* path, with no length/cost guarantee.
 */
export type Optimality = 'always' | 'unweighted' | 'never';

export interface PathAlgorithmInfo {
  readonly id: PathAlgorithmId;
  readonly label: string;
  /** Whether terrain weight affects which path it finds. */
  readonly usesWeights: boolean;
  readonly optimality: Optimality;
}

export const PATH_ALGORITHMS: readonly PathAlgorithmInfo[] = [
  {
    id: 'bfs',
    label: 'Breadth-first Search',
    usesWeights: false,
    optimality: 'unweighted',
  },
  {
    id: 'dfs',
    label: 'Depth-first Search',
    usesWeights: false,
    optimality: 'never',
  },
  {
    id: 'greedy',
    label: 'Greedy Best-First Search',
    usesWeights: false,
    optimality: 'never',
  },
  {
    id: 'dijkstra',
    label: "Dijkstra's Algorithm",
    usesWeights: true,
    optimality: 'always',
  },
  {
    id: 'astar',
    label: 'A* Algorithm',
    usesWeights: true,
    optimality: 'always',
  },
];

export interface SearchProblem {
  readonly grid: Grid;
  readonly start: number;
  readonly goal: number;
}

/**
 * What a search reports as it runs, in order:
 * - `discover`: a cell was reached for the first time and added to the
 *   frontier (never emitted for the start or goal cell).
 * - `expand`: a cell was taken off the frontier and its neighbors examined.
 */
export type SearchEvent =
  | { readonly type: 'discover'; readonly index: number }
  | { readonly type: 'expand'; readonly index: number };

export interface SearchResult {
  /** Cell indices from start to goal (both included), or null if unreachable. */
  readonly path: number[] | null;
  /**
   * Terrain-weighted cost of `path` (the sum of every entered cell's
   * weight), whatever the algorithm - so results are comparable across
   * algorithms, including the weight-blind ones. Infinity when no path.
   */
  readonly cost: number;
  /** Cells expanded. */
  readonly expanded: number;
  /** Cells discovered (= `discover` events). */
  readonly discovered: number;
}

interface FrontierEntry {
  readonly index: number;
  /** The cell this entry was reached from (-1 for the start). */
  readonly parent: number;
  /** Cost so far along the route this entry was reached by. */
  readonly cost: number;
}

interface Frontier {
  push(entry: FrontierEntry, priority: number, tiebreak: number): void;
  pop(): FrontierEntry | undefined;
}

/**
 * When a neighbor may be pushed onto the frontier:
 * - `first-discovery`: only the first time it's seen (BFS, Greedy). For a
 *   FIFO queue, a later duplicate could never pop first anyway.
 * - `until-expanded`: every time it's seen until it's expanded (DFS) - in
 *   a LIFO stack the *latest* sighting pops first, which is what makes the
 *   search go deep.
 * - `when-cheaper`: whenever this route beats its best cost so far
 *   (Dijkstra, A*) - "decrease-key" by pushing a new entry; the stale one
 *   is skipped when popped because the cell is already expanded by then.
 */
type AdmissionRule = 'first-discovery' | 'until-expanded' | 'when-cheaper';

interface AlgorithmSpec {
  createFrontier(): Frontier;
  admission: AdmissionRule;
  usesWeights: boolean;
  /** Frontier priority for a cell reached at cost `cost` (heap frontiers only). */
  priority(cost: number, estimate: number): number;
  heuristic: Heuristic | null;
}

function queueFrontier(): Frontier {
  const queue = new Queue<FrontierEntry>();
  return { push: entry => queue.push(entry), pop: () => queue.pop() };
}

function stackFrontier(): Frontier {
  const stack = new Stack<FrontierEntry>();
  return { push: entry => stack.push(entry), pop: () => stack.pop() };
}

function heapFrontier(): Frontier {
  const heap = new MinHeap<FrontierEntry>();
  return {
    push: (entry, priority, tiebreak) => heap.push(entry, priority, tiebreak),
    pop: () => heap.pop(),
  };
}

// All five algorithms are the same loop (see search() below); these specs
// are the only thing that differs between them.
const SPECS: Record<PathAlgorithmId, AlgorithmSpec> = {
  bfs: {
    createFrontier: queueFrontier,
    admission: 'first-discovery',
    usesWeights: false,
    priority: () => 0,
    heuristic: null,
  },
  dfs: {
    createFrontier: stackFrontier,
    admission: 'until-expanded',
    usesWeights: false,
    priority: () => 0,
    heuristic: null,
  },
  greedy: {
    // Ranks purely by estimated distance to the goal; the cost of getting
    // here (and so terrain weight) never factors in.
    createFrontier: heapFrontier,
    admission: 'first-discovery',
    usesWeights: false,
    priority: (_cost, estimate) => estimate,
    heuristic: euclidean,
  },
  dijkstra: {
    createFrontier: heapFrontier,
    admission: 'when-cheaper',
    usesWeights: true,
    priority: cost => cost,
    heuristic: null,
  },
  astar: {
    // f = g + h, where g is the cost *so far* of this entry's own route.
    // (The previous implementation built f from the parent's f, so h
    // accumulated along the path and A* stopped being optimal.)
    createFrontier: heapFrontier,
    admission: 'when-cheaper',
    usesWeights: true,
    priority: (cost, estimate) => cost + estimate,
    heuristic: manhattan,
  },
};

/**
 * Runs `algorithm` on `problem`, yielding a {@link SearchEvent} for every
 * step and returning the {@link SearchResult} once the goal is reached or
 * the frontier runs dry. As a generator it can be stepped one event at a
 * time (for step-through playback) or drained in one go with
 * {@link runSearch}.
 */
export function* search(
  problem: SearchProblem,
  algorithm: PathAlgorithmId
): Generator<SearchEvent, SearchResult, void> {
  const { grid, start, goal } = problem;
  const size = grid.rows * grid.columns;
  if (!isCell(start, size) || !isCell(goal, size)) {
    throw new RangeError(
      `start (${start}) and goal (${goal}) must be cells of a ${size}-cell grid`
    );
  }
  if (start === goal)
    return { path: [start], cost: 0, expanded: 0, discovered: 0 };

  const spec = SPECS[algorithm];
  const frontier = spec.createFrontier();
  const parentOf = new Int32Array(size).fill(-1);
  const bestCost = new Float64Array(size).fill(Infinity);
  const discovered = new Uint8Array(size);
  const expanded = new Uint8Array(size);
  const adjacent = new Int32Array(4);
  let expandedCount = 0;
  let discoveredCount = 0;

  const estimate = (index: number): number =>
    spec.heuristic ? spec.heuristic(grid, index, goal) : 0;

  bestCost[start] = 0;
  discovered[start] = 1;
  frontier.push(
    { index: start, parent: -1, cost: 0 },
    spec.priority(0, estimate(start)),
    estimate(start)
  );

  for (let entry = frontier.pop(); entry; entry = frontier.pop()) {
    const { index } = entry;
    if (expanded[index]) continue;

    parentOf[index] = entry.parent;
    if (index === goal) {
      const path = tracePath(parentOf, goal);
      return {
        path,
        cost: weightedCost(grid, path),
        expanded: expandedCount,
        discovered: discoveredCount,
      };
    }

    expanded[index] = 1;
    expandedCount++;
    yield { type: 'expand', index };

    const count = neighbors(grid, index, adjacent);
    for (let k = 0; k < count; k++) {
      const next = adjacent[k];
      if (grid.walls[next] || expanded[next]) continue;

      const cost = entry.cost + (spec.usesWeights ? grid.weights[next] : 1);
      if (spec.admission === 'first-discovery' && discovered[next]) continue;
      if (spec.admission === 'when-cheaper' && cost >= bestCost[next]) continue;
      if (cost < bestCost[next]) bestCost[next] = cost;

      const h = estimate(next);
      frontier.push(
        { index: next, parent: index, cost },
        spec.priority(cost, h),
        h
      );

      if (!discovered[next]) {
        discovered[next] = 1;
        if (next !== goal) {
          discoveredCount++;
          yield { type: 'discover', index: next };
        }
      }
    }
  }

  return {
    path: null,
    cost: Infinity,
    expanded: expandedCount,
    discovered: discoveredCount,
  };
}

/** Runs a search to completion, collecting every event it emits. */
export function runSearch(
  problem: SearchProblem,
  algorithm: PathAlgorithmId
): { events: SearchEvent[]; result: SearchResult } {
  const events: SearchEvent[] = [];
  const run = search(problem, algorithm);
  for (let step = run.next(); ; step = run.next()) {
    if (step.done) return { events, result: step.value };
    events.push(step.value);
  }
}

function isCell(index: number, size: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < size;
}

function tracePath(parentOf: Int32Array, goal: number): number[] {
  const path: number[] = [];
  for (let index = goal; index !== -1; index = parentOf[index])
    path.push(index);
  return path.reverse();
}

function weightedCost(grid: Grid, path: number[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += grid.weights[path[i]];
  return total;
}
