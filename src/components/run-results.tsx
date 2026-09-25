import { useState, type ReactNode } from 'react';
import { CheckIcon, TrophyIcon, TriangleAlertIcon } from 'lucide-react';
import { WEIGHTED_TERRAIN_COST, type PathAlgorithmId } from '../engine';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
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
function isCheapest(run: SearchRun, bestCost: number | null): boolean | null {
  if (!run.result.path || bestCost === null) return null;
  return run.result.cost === bestCost;
}

function CheapestNote({
  cheapest,
  run,
  bestCost,
}: {
  cheapest: boolean | null;
  run: SearchRun;
  bestCost: number | null;
}) {
  if (cheapest === null) return null;
  return cheapest ? (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-400">
      <CheckIcon className="size-3.5" aria-hidden="true" /> cheapest
    </span>
  ) : (
    <span className="text-xs font-medium text-amber-400">
      +{run.result.cost - (bestCost ?? 0)} over best
    </span>
  );
}

// What the polite live region says for each phase - it only changes (and
// so is only announced) when the phase does.
function exploreAnnouncement(
  run: SearchRun,
  phase: RunPhase,
  cheapest: boolean | null
): string {
  const name = algorithmLabel(run.algorithm);
  if (phase === 'explore') return `${name} is exploring.`;
  if (phase === 'unreachable') return `${name} found no path.`;
  if (phase === 'path') return `${name} found a path.`;
  const cost = `Path found: ${run.result.path?.length} cells, cost ${formatCost(run.result.cost)}`;
  return cheapest === false
    ? `${cost}, not the cheapest.`
    : `${cost}, the cheapest possible.`;
}

/** Stats and a pseudocode walkthrough for the single search on screen. */
export function ExploreResults({ visualizer }: { visualizer: Visualizer }) {
  const snapshot = useVisualizerSnapshot(visualizer);
  const { tick } = usePlayerState(visualizer.player);
  const [run] = searchRuns(snapshot);
  if (!run) return null;
  const cheapest = isCheapest(run, snapshot.bestCost);

  return (
    <div className="flex flex-col gap-4">
      {/* A plain labeled group, not a live region: "Nodes visited" changes
          every animation frame, which would flood a screen reader. Phase
          changes are announced once each, below. */}
      <div
        role="group"
        aria-label="Run statistics"
        className="grid grid-cols-2 gap-2"
      >
        <Stat label="Nodes visited" value={discoveredAt(run, tick)} />
        <Stat label="Path length" value={run.result.path?.length ?? '—'} />
        <Stat
          label="Path cost"
          value={formatCost(run.result.cost)}
          note={
            <CheapestNote
              cheapest={cheapest}
              run={run}
              bestCost={snapshot.bestCost}
            />
          }
        />
        <Stat label="Algorithm time" value={`${run.searchMs.toFixed(2)}ms`} />
      </div>
      <p className="sr-only" aria-live="polite">
        {exploreAnnouncement(run, runPhase(run, tick), cheapest)}
      </p>
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

/** A column header that explains itself on hover, focus or tap. */
function ColumnHint({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          // Radix tooltips ignore taps; this opens on click, and Radix's own close-on-click makes a second tap close it.
          onClick={() => setOpen(true)}
          className="cursor-help rounded-sm underline decoration-muted-foreground/60 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Live race standings. Every algorithm advances one discovered cell per
 * tick, so finishing order is "fewest cells explored before reaching the
 * goal"; the cheapest column checks each path against the best possible.
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

  // Announced once, when every racer has finished (not on every frame).
  const allDone = runs.every(run => searchFinished(run, tick));
  const winners = finishers.filter(run => placeOf(run) === 1);
  const announcement = !allDone
    ? 'Race in progress.'
    : winners.length === 0
      ? 'Race finished: no path exists.'
      : `Race finished. First: ${winners.map(run => algorithmLabel(run.algorithm)).join(' and ')}.`;

  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <TooltipProvider delayDuration={150}>
        <table aria-label="Race standings" className="w-full text-left text-xs">
          <thead className="bg-background/60 text-[11px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Algorithm</th>
              <th className="px-2 py-2 text-right font-medium">Explored</th>
              <th className="px-2 py-2 text-right font-medium">
                <ColumnHint label="Cost">
                  The total cost of the path this algorithm found. Stepping onto
                  a normal cell costs 1 and weighted terrain costs{' '}
                  {WEIGHTED_TERRAIN_COST}. The start cell is free.
                </ColumnHint>
              </th>
              <th className="px-3 py-2 text-right font-medium">
                <ColumnHint label="Cheapest">
                  Is this path as cheap as any path on this board? A check means
                  yes; +N means it costs N more than the cheapest possible,
                  judged against Dijkstra, which always finds the cheapest. With
                  weighted terrain, the cheapest path is not always the one with
                  the fewest cells.
                </ColumnHint>
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map(run => {
              const done = searchFinished(run, tick);
              const place = done && run.result.path ? placeOf(run) : null;
              const cheapest = done ? isCheapest(run, snapshot.bestCost) : null;
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
                    {cheapest === true && (
                      <CheckIcon
                        className="ml-auto size-4 text-emerald-400"
                        aria-label="Yes"
                      />
                    )}
                    {cheapest === false && (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <TriangleAlertIcon
                          className="size-3.5"
                          aria-hidden="true"
                        />
                        +{run.result.cost - (snapshot.bestCost ?? 0)}
                      </span>
                    )}
                    {cheapest === null && (
                      <span className="text-muted-foreground">…</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TooltipProvider>
    </div>
  );
}
