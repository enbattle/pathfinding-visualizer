import type { ReactNode } from 'react';
import { CheckIcon, TrophyIcon, TriangleAlertIcon } from 'lucide-react';
import type { PathAlgorithmId } from '../engine';
import {
  discoveredAt,
  runPhase,
  searchFinished,
  type RunPhase,
  type SearchRun,
} from '../visualizer/runs';
import { searchRuns, type Visualizer } from '../visualizer/visualizer';
import {
  ALGORITHM_GUIDES,
  algorithmLabel,
  shortAlgorithmLabel,
} from './algorithm-guides';
import { usePlayerState, useVisualizerSnapshot } from './use-visualizer';
import { cn } from '@/lib/utils';

function formatCost(cost: number): string {
  return Number.isFinite(cost) ? String(cost) : '—';
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5 text-lg font-semibold tabular-nums">
        {value}
        {note}
      </div>
    </div>
  );
}

/** Is `run`'s path as cheap as the best possible on this board? */
function isShortest(run: SearchRun, bestCost: number | null): boolean | null {
  if (!run.result.path || bestCost === null) return null;
  return run.result.cost === bestCost;
}

function ShortestNote({
  shortest,
  run,
  bestCost,
}: {
  shortest: boolean | null;
  run: SearchRun;
  bestCost: number | null;
}) {
  if (shortest === null) return null;
  return shortest ? (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-400">
      <CheckIcon className="size-3.5" aria-hidden="true" /> shortest
    </span>
  ) : (
    <span className="text-xs font-medium text-amber-400">
      +{run.result.cost - (bestCost ?? 0)} over best
    </span>
  );
}

/** Stats and a pseudocode walkthrough for the single search on screen. */
export function ExploreResults({ visualizer }: { visualizer: Visualizer }) {
  const snapshot = useVisualizerSnapshot(visualizer);
  const { tick } = usePlayerState(visualizer.player);
  const [run] = searchRuns(snapshot);
  if (!run) return null;
  const shortest = isShortest(run, snapshot.bestCost);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="status"
        aria-label="Run statistics"
        className="grid grid-cols-2 gap-2"
      >
        <Stat label="Nodes visited" value={discoveredAt(run, tick)} />
        <Stat label="Path length" value={run.result.path?.length ?? '—'} />
        <Stat
          label="Path cost"
          value={formatCost(run.result.cost)}
          note={
            <ShortestNote
              shortest={shortest}
              run={run}
              bestCost={snapshot.bestCost}
            />
          }
        />
        <Stat label="Algorithm time" value={`${run.searchMs.toFixed(2)}ms`} />
      </div>
      <HowItWorks algorithm={run.algorithm} phase={runPhase(run, tick)} />
    </div>
  );
}

const PHASE_LABELS: Record<RunPhase, string> = {
  explore: 'Exploring',
  path: 'Tracing the path',
  found: 'Path found',
  unreachable: 'No path exists',
};

/** The selected algorithm's pseudocode, with the lines for the current phase highlighted. */
export function HowItWorks({
  algorithm,
  phase,
}: {
  algorithm: PathAlgorithmId;
  phase: RunPhase | null;
}) {
  const guide = ALGORITHM_GUIDES[algorithm];
  return (
    <section aria-labelledby="how-it-works" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 id="how-it-works" className="text-sm font-semibold">
          How {algorithmLabel(algorithm)} works
        </h3>
        {phase && (
          <span className="text-xs text-primary">{PHASE_LABELS[phase]}</span>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {guide.summary}
      </p>
      {/* Lines wrap instead of scrolling sideways; indentation is padding,
          and a wrapped line hangs under its own first character. */}
      <div className="rounded-lg border border-border/70 bg-background/60 py-2 font-mono text-[11px] leading-5">
        {guide.pseudocode.map((line, i) => {
          const active = phase !== null && line.phases.includes(phase);
          return (
            <div
              key={i}
              aria-current={active ? 'step' : undefined}
              style={{ paddingLeft: `${0.75 + line.depth * 1.1}rem` }}
              className={cn(
                'border-l-2 pr-3 break-words transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-transparent text-muted-foreground'
              )}
            >
              {line.text}
            </div>
          );
        })}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Frontier</dt>
        <dd>{guide.frontier}</dd>
        <dt className="text-muted-foreground">Guarantee</dt>
        <dd>{guide.guarantee}</dd>
        <dt className="text-muted-foreground">Time</dt>
        <dd className="font-mono">{guide.complexity}</dd>
      </dl>
    </section>
  );
}

/**
 * Live race standings. Every algorithm advances one discovered cell per
 * tick, so finishing order is "fewest cells explored before reaching the
 * goal"; the shortest column checks each path against the best possible.
 */
export function RaceScoreboard({ visualizer }: { visualizer: Visualizer }) {
  const snapshot = useVisualizerSnapshot(visualizer);
  const { tick } = usePlayerState(visualizer.player);
  const runs = searchRuns(snapshot);
  if (runs.length === 0) return null;

  // Finishers ranked by how few cells they explored (ties share a place).
  const finishers = runs.filter(
    run => run.result.path && searchFinished(run, tick)
  );
  const placeOf = (run: SearchRun) =>
    1 + finishers.filter(other => other.discoveries < run.discoveries).length;

  return (
    <div
      role="status"
      aria-label="Race standings"
      className="overflow-hidden rounded-lg border border-border/70"
    >
      <table className="w-full text-left text-xs">
        <thead className="bg-background/60 text-[11px] tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">Algorithm</th>
            <th className="px-2 py-2 text-right font-medium">Explored</th>
            <th className="px-2 py-2 text-right font-medium">Cost</th>
            <th className="px-3 py-2 text-right font-medium">Shortest</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => {
            const done = searchFinished(run, tick);
            const place = done && run.result.path ? placeOf(run) : null;
            const shortest = done ? isShortest(run, snapshot.bestCost) : null;
            return (
              <tr key={run.algorithm} className="border-t border-border/60">
                <th scope="row" className="px-3 py-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    {place === 1 && (
                      <TrophyIcon
                        className="size-3.5 text-amber-400"
                        aria-label="First"
                      />
                    )}
                    {place !== null && place > 1 && (
                      <span
                        className="w-3.5 text-center text-muted-foreground"
                        aria-label={`Place ${place}`}
                      >
                        {place}
                      </span>
                    )}
                    <span title={algorithmLabel(run.algorithm)}>
                      {shortAlgorithmLabel(run.algorithm)}
                    </span>
                  </span>
                </th>
                <td className="px-2 py-2 text-right tabular-nums">
                  {discoveredAt(run, tick)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {done ? formatCost(run.result.cost) : '…'}
                </td>
                <td className="px-3 py-2 text-right">
                  {shortest === true && (
                    <CheckIcon
                      className="ml-auto size-4 text-emerald-400"
                      aria-label="Yes"
                    />
                  )}
                  {shortest === false && (
                    <span className="inline-flex items-center gap-1 text-amber-400">
                      <TriangleAlertIcon
                        className="size-3.5"
                        aria-hidden="true"
                      />
                      +{run.result.cost - (snapshot.bestCost ?? 0)}
                    </span>
                  )}
                  {shortest === null && (
                    <span className="text-muted-foreground">…</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
