import { PATH_ALGORITHMS, type PathAlgorithmId } from '../engine';
import type { RunPhase } from '../visualizer/runs';

interface PseudocodeLine {
  readonly text: string;
  /** Indentation depth. */
  readonly depth: number;
  /** Phases during which this line is highlighted. */
  readonly phases: readonly RunPhase[];
}

export interface AlgorithmGuide {
  readonly summary: string;
  readonly frontier: string;
  readonly guarantee: string;
  readonly complexity: string;
  readonly pseudocode: readonly PseudocodeLine[];
}

const line = (
  depth: number,
  text: string,
  ...phases: RunPhase[]
): PseudocodeLine => ({ text, depth, phases });

// The loop every algorithm shares; only the frontier and how a neighbor is
// admitted/prioritized differ (mirroring SPECS in src/engine/pathfinding.ts).
function pseudocode(
  frontierInit: string,
  take: string,
  admit: readonly string[]
): PseudocodeLine[] {
  return [
    line(0, frontierInit),
    line(0, 'while frontier is not empty:', 'explore'),
    line(1, take, 'explore'),
    line(1, 'if cell is goal:', 'path', 'found'),
    line(2, 'return path traced back through parent[]', 'path', 'found'),
    line(1, 'for each open neighbor n of cell:', 'explore'),
    ...admit.map((text, i) => line(i === 0 ? 2 : 3, text, 'explore')),
    line(0, 'return "no path"', 'unreachable'),
  ];
}

export const ALGORITHM_GUIDES: Record<PathAlgorithmId, AlgorithmGuide> = {
  bfs: {
    summary:
      'Explores in rings of equal distance from the start, so the first time it reaches the goal is along a fewest-steps route.',
    frontier: 'Queue (first in, first out)',
    guarantee: 'Fewest steps. Ignores terrain weight.',
    complexity: 'O(V + E)',
    pseudocode: pseudocode(
      'frontier ← queue [start]; mark start seen',
      'cell ← frontier.dequeue()',
      ['if n not seen:', 'mark n seen; parent[n] ← cell', 'frontier.enqueue(n)']
    ),
  },
  dfs: {
    summary:
      'Follows one route as deep as it can before backtracking. Fast to write, but the path it finds can wander far from the shortest.',
    frontier: 'Stack (last in, first out)',
    guarantee: 'None - any path.',
    complexity: 'O(V + E)',
    pseudocode: pseudocode(
      'frontier ← stack [start]',
      'cell ← frontier.pop(); skip if already expanded',
      ['if n not expanded:', 'parent[n] ← cell; frontier.push(n)']
    ),
  },
  greedy: {
    summary:
      'Always heads for whichever frontier cell looks closest to the goal. Often very fast, but it never considers the cost already paid, so its path can be long or expensive.',
    frontier: 'Min-heap by straight-line distance to goal',
    guarantee: 'None - fast, not necessarily short.',
    complexity: 'O((V + E) log V)',
    pseudocode: pseudocode(
      'frontier ← heap [(h(start), start)]',
      'cell ← frontier.popMin()',
      [
        'if n not seen:',
        'mark n seen; parent[n] ← cell',
        'frontier.push(h(n), n)   // h = distance to goal',
      ]
    ),
  },
  dijkstra: {
    summary:
      'Expands cells in order of the cheapest cost to reach them, so weighted terrain is avoided when a cheaper detour exists.',
    frontier: 'Min-heap by cost so far (g)',
    guarantee: 'Lowest total cost.',
    complexity: 'O((V + E) log V)',
    pseudocode: pseudocode(
      'g[start] ← 0; frontier ← heap [(0, start)]',
      'cell ← frontier.popMin(); skip if already expanded',
      [
        'if g[cell] + cost(n) < g[n]:',
        'g[n] ← g[cell] + cost(n); parent[n] ← cell',
        'frontier.push(g[n], n)',
      ]
    ),
  },
  astar: {
    summary:
      "Dijkstra's algorithm plus a sense of direction: it ranks cells by cost so far plus an estimate of the cost remaining, which must never overestimate.",
    frontier: 'Min-heap by g + h (Manhattan distance), ties toward the goal',
    guarantee: 'Lowest total cost, usually exploring far less than Dijkstra.',
    complexity: 'O((V + E) log V)',
    pseudocode: pseudocode(
      'g[start] ← 0; frontier ← heap [(h(start), start)]',
      'cell ← frontier.popMin(); skip if already expanded',
      [
        'if g[cell] + cost(n) < g[n]:',
        'g[n] ← g[cell] + cost(n); parent[n] ← cell',
        'frontier.push(g[n] + h(n), n)   // h = Manhattan distance',
      ]
    ),
  },
};

/** Display name for an algorithm id. */
export function algorithmLabel(id: PathAlgorithmId): string {
  return PATH_ALGORITHMS.find(algorithm => algorithm.id === id)?.label ?? id;
}

const SHORT_LABELS: Record<PathAlgorithmId, string> = {
  bfs: 'BFS',
  dfs: 'DFS',
  greedy: 'Greedy',
  dijkstra: 'Dijkstra',
  astar: 'A*',
};

/** Compact name for tight spaces like the race standings. */
export function shortAlgorithmLabel(id: PathAlgorithmId): string {
  return SHORT_LABELS[id];
}
