import { runPhase, type SearchRun } from '../visualizer/runs';
import type { PaintMode, Visualizer } from '../visualizer/visualizer';
import { algorithmLabel } from './algorithm-guides';
import { BoardCanvas } from './board-canvas';
import { PlaybackControls } from './playback-controls';
import { usePlayerState, useVisualizerSnapshot } from './use-visualizer';
import { cn } from '@/lib/utils';

const LEGEND_ITEMS: { label: string; swatchClassName: string }[] = [
  { label: 'Start', swatchClassName: 'legend-swatch-start' },
  { label: 'Goal', swatchClassName: 'legend-swatch-goal' },
  { label: 'Wall', swatchClassName: 'legend-swatch-wall' },
  { label: 'Weighted (cost 5)', swatchClassName: 'legend-swatch-weight' },
  { label: 'Visited, early → late', swatchClassName: 'legend-swatch-visited' },
  { label: 'Path', swatchClassName: 'legend-swatch-path' },
];

const STATUS_LABELS = {
  explore: 'exploring',
  path: 'found',
  found: 'found',
  unreachable: 'no path',
} as const;

function TileStatus({
  visualizer,
  run,
}: {
  visualizer: Visualizer;
  run: SearchRun;
}) {
  const { tick } = usePlayerState(visualizer.player);
  const phase = runPhase(run, tick);
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-medium',
        phase === 'explore' && 'bg-primary/15 text-primary',
        (phase === 'path' || phase === 'found') &&
          'bg-emerald-500/15 text-emerald-400',
        phase === 'unreachable' && 'bg-destructive/15 text-destructive'
      )}
    >
      {STATUS_LABELS[phase]}
    </span>
  );
}

interface BoardAreaProps {
  visualizer: Visualizer;
  paintMode: PaintMode;
}

/**
 * The board(s) and playback. One board normally; during a race, one board
 * per algorithm - all showing the same grid (editing any of them edits
 * it), each drawing its own run, all driven by the one shared playhead.
 */
export function BoardArea({ visualizer, paintMode }: BoardAreaProps) {
  const snapshot = useVisualizerSnapshot(visualizer);
  const searches = snapshot.runs.filter(
    (run): run is SearchRun => run.kind === 'search'
  );
  const racing = searches.length > 1;
  const longestRun = Math.max(0, ...snapshot.runs.map(run => run.length));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div
        className={cn(
          'grid min-h-0 flex-1 gap-3',
          racing && 'md:grid-cols-2',
          searches.length > 2 && 'md:grid-rows-2'
        )}
      >
        {(racing ? searches : [null]).map((run, i) => (
          <div
            key={run?.algorithm ?? 'board'}
            className={cn(
              'flex min-h-0 flex-col gap-1.5',
              racing &&
                'min-h-48 rounded-xl border border-border/60 bg-background/30 p-2',
              // Three racers: the last board spans the bottom row.
              searches.length === 3 && i === 2 && 'md:col-span-2'
            )}
          >
            {run && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold">
                  {algorithmLabel(run.algorithm)}
                </span>
                <TileStatus visualizer={visualizer} run={run} />
              </div>
            )}
            <div className="min-h-0 flex-1">
              <BoardCanvas
                visualizer={visualizer}
                paintMode={paintMode}
                runIndex={i}
                label={run ? `${algorithmLabel(run.algorithm)} board` : 'Board'}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
        {snapshot.runs.length > 0 && (
          <PlaybackControls player={visualizer.player} runLength={longestRun} />
        )}
        <ul
          className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
          aria-label="Cell color legend"
        >
          {LEGEND_ITEMS.map(item => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span
                className={cn('legend-swatch', item.swatchClassName)}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
