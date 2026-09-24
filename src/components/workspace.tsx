import React from 'react';
import {
  BrickWallIcon,
  CheckIcon,
  InfoIcon,
  LinkIcon,
  RouteIcon,
  SwordsIcon,
  XIcon,
} from 'lucide-react';
import {
  MAZE_ALGORITHMS,
  PATH_ALGORITHMS,
  type MazeAlgorithmId,
  type PathAlgorithmId,
} from '../engine';
import { decodeShare, encodeShare, type ShareMode } from '../visualizer/share';
import {
  MAX_RACERS,
  Visualizer,
  type PaintMode,
  type VisualizerOptions,
} from '../visualizer/visualizer';
import {
  computeBoardSize,
  computeBoardSizeFromDimensions,
  randomStartCoordinate,
  randomGoalCoordinate,
  speedToRate,
  toCellIndex,
  DEFAULT_SPEED,
} from './board-setup';
import { BoardArea } from './board-area';
import { Segmented } from './segmented';
import { AboutDialog } from './about-dialog';
import { ExploreResults, HowItWorks, RaceScoreboard } from './run-results';
import { useVisualizerSnapshot } from './use-visualizer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const MIN_RACERS = 2;
// In menu (PATH_ALGORITHMS) order, like any racer selection.
const DEFAULT_RACERS: PathAlgorithmId[] = ['greedy', 'dijkstra', 'astar'];

interface WorkspaceProps {
  /** Dependency injection point for tests (e.g. a fake animation clock). */
  createVisualizer?: (options: VisualizerOptions) => Visualizer;
}

const defaultCreateVisualizer = (options: VisualizerOptions) =>
  new Visualizer(options);

// The decoded share link in the URL fragment, or null when there is none.
function readSharedLink() {
  const hash = window.location.hash;
  return hash.length > 1 ? decodeShare(hash) : null;
}

function randomAnchors(rows: number, columns: number) {
  return {
    start: toCellIndex(randomStartCoordinate(rows, columns), columns),
    goal: toCellIndex(randomGoalCoordinate(rows, columns), columns),
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

const Workspace = ({
  createVisualizer = defaultCreateVisualizer,
}: WorkspaceProps) => {
  // The share link in the URL, if any: read once on load, and again when
  // the fragment changes (a pasted link) - never inside an effect.
  const [shared, setShared] = React.useState(readSharedLink);
  const initial = shared?.ok ? shared.state : null;
  const [mode, setMode] = React.useState<ShareMode>(initial?.mode ?? 'explore');
  const [pathAlgorithm, setPathAlgorithm] = React.useState<PathAlgorithmId>(
    initial?.mode === 'explore' ? initial.algorithms[0] : 'astar'
  );
  const [racers, setRacers] = React.useState<PathAlgorithmId[]>(
    initial?.mode === 'race' ? [...initial.algorithms] : DEFAULT_RACERS
  );
  const [wallAlgorithm, setWallAlgorithm] =
    React.useState<MazeAlgorithmId>('recursive-division');
  const [paintMode, setPaintMode] = React.useState<PaintMode>('wall');
  const [speed, setSpeed] = React.useState<number>(DEFAULT_SPEED);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [shareStatus, setShareStatus] = React.useState<
    'idle' | 'copied' | 'ready'
  >('idle');
  const [errorDismissed, setErrorDismissed] = React.useState(false);
  const loadError =
    shared && !shared.ok && !errorDismissed ? shared.error : null;

  React.useEffect(() => {
    const onHashChange = () => {
      const next = readSharedLink();
      if (next?.ok) {
        setMode(next.state.mode);
        if (next.state.mode === 'race') setRacers([...next.state.algorithms]);
        else setPathAlgorithm(next.state.algorithms[0]);
      }
      setErrorDismissed(false);
      setShared(next); // rebuilds the board (see below)
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // The board is created once per share link: from the link if it's valid,
  // otherwise sized to the measured board area.
  const boardAreaRef = React.useRef<HTMLDivElement>(null);
  const [visualizer, setVisualizer] = React.useState<Visualizer | null>(null);
  const initialSpeedRef = React.useRef(speed);
  React.useLayoutEffect(() => {
    const element = boardAreaRef.current;
    if (!element) return;
    const rate = speedToRate(initialSpeedRef.current);

    let created: Visualizer;
    if (shared?.ok) {
      const { board, algorithms } = shared.state;
      created = createVisualizer({ ...board, rate });
      // A shared link plays its run straight away.
      created.race(algorithms);
    } else {
      // jsdom (the test environment) doesn't lay anything out, so a zero
      // size falls back to a window-based estimate.
      const { clientWidth, clientHeight } = element;
      const { rows, columns } =
        clientWidth > 0 && clientHeight > 0
          ? computeBoardSizeFromDimensions(clientWidth, clientHeight)
          : computeBoardSize();
      created = createVisualizer({
        rows,
        columns,
        ...randomAnchors(rows, columns),
        rate,
      });
    }
    setVisualizer(created);
    return () => created.dispose();
  }, [createVisualizer, shared]);

  React.useEffect(() => {
    if (shareStatus === 'idle') return;
    const timer = window.setTimeout(() => setShareStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [shareStatus]);

  const changeSpeed = (value: number) => {
    setSpeed(value);
    visualizer?.setRate(speedToRate(value));
  };

  const changeMode = (next: ShareMode) => {
    if (next === mode) return;
    setMode(next);
    visualizer?.resetPath();
  };

  const toggleRacer = (id: PathAlgorithmId) =>
    setRacers(current =>
      current.includes(id)
        ? current.filter(racer => racer !== id)
        : // Keep the menu's order, so boards and standings are stable.
          PATH_ALGORITHMS.map(a => a.id).filter(
            racer => racer === id || current.includes(racer)
          )
    );

  const share = async () => {
    if (!visualizer) return;
    const fragment = encodeShare({
      board: visualizer.exportBoard(),
      mode,
      algorithms: mode === 'race' ? racers : [pathAlgorithm],
    });
    // replaceState doesn't fire hashchange, so this doesn't reload the board.
    window.history.replaceState(null, '', `#${fragment}`);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus('copied');
    } catch {
      setShareStatus('ready'); // e.g. clipboard permission denied
    }
  };

  const racersValid =
    racers.length >= MIN_RACERS && racers.length <= MAX_RACERS;

  return (
    <div className="flex min-h-screen flex-col lg:h-dvh">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border/70 bg-background/60 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <RouteIcon className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base leading-tight font-semibold">
              Pathfinding Visualizer
            </h1>
            <p className="text-xs text-muted-foreground">
              Search and maze algorithms, step by step
            </p>
          </div>
        </div>
        <Segmented
          label="Mode"
          value={mode}
          onChange={changeMode}
          options={[
            { value: 'explore', label: 'Explore', icon: <RouteIcon /> },
            { value: 'race', label: 'Race', icon: <SwordsIcon /> },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <span aria-live="polite" className="text-xs text-muted-foreground">
            {shareStatus === 'copied' && 'Link copied'}
            {shareStatus === 'ready' && 'Link is in the address bar'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!visualizer}
            onClick={share}
          >
            {shareStatus === 'copied' ? <CheckIcon /> : <LinkIcon />} Share
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="About this app"
            onClick={() => setAboutOpen(true)}
          >
            <InfoIcon />
          </Button>
        </div>
      </header>

      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />

      <main className="grid flex-1 gap-4 p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)] lg:p-6">
        {/* Board area. boardAreaRef measures the space the board has, so
            it carries no padding of its own. */}
        <section
          aria-label="Board"
          className="flex min-h-[28rem] min-w-0 flex-col rounded-2xl border border-border/70 bg-card/60 p-3 shadow-sm lg:min-h-0"
        >
          <div ref={boardAreaRef} className="min-h-0 flex-1">
            {visualizer && (
              <BoardArea visualizer={visualizer} paintMode={paintMode} />
            )}
          </div>
        </section>

        <aside
          aria-label="Controls"
          className="flex min-h-0 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] flex-col gap-5 overflow-y-auto rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm"
        >
          {loadError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
            >
              <span className="flex-1">
                Couldn't open the shared board: {loadError}
              </span>
              <button
                type="button"
                aria-label="Dismiss"
                className="text-amber-200/70 hover:text-amber-100"
                onClick={() => setErrorDismissed(true)}
              >
                <XIcon className="size-4" />
              </button>
            </div>
          )}

          {mode === 'explore' ? (
            <Section title="Pathfinding">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pathAlgorithmChoices">Algorithm</Label>
                <Select
                  value={pathAlgorithm}
                  // Radix only ever reports one of the SelectItem values.
                  onValueChange={value =>
                    setPathAlgorithm(value as PathAlgorithmId)
                  }
                >
                  <SelectTrigger
                    id="pathAlgorithmChoices"
                    aria-label="Path Algorithm Choices"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PATH_ALGORITHMS.map(({ id, label }) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                disabled={!visualizer}
                onClick={() => visualizer?.visualize(pathAlgorithm)}
              >
                <RouteIcon /> Visualize
              </Button>
            </Section>
          ) : (
            <Section title="Race">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Pick {MIN_RACERS}–{MAX_RACERS} algorithms. Each explores one
                cell per step on the same board, so the first to reach the goal
                did the least work.
              </p>
              <div
                role="group"
                aria-label="Racers"
                className="flex flex-wrap gap-1.5"
              >
                {PATH_ALGORITHMS.map(({ id, label }) => {
                  const selected = racers.includes(id);
                  const locked = selected
                    ? racers.length <= MIN_RACERS
                    : racers.length >= MAX_RACERS;
                  return (
                    <Button
                      key={id}
                      type="button"
                      size="sm"
                      variant={selected ? 'secondary' : 'outline'}
                      aria-pressed={selected}
                      disabled={locked}
                      onClick={() => toggleRacer(id)}
                    >
                      {selected && <CheckIcon />}
                      {label}
                    </Button>
                  );
                })}
              </div>
              <Button
                type="button"
                disabled={!visualizer || !racersValid}
                onClick={() => visualizer?.race(racers)}
              >
                <SwordsIcon /> Start race
              </Button>
            </Section>
          )}

          {visualizer && (
            <>
              <StaleLinkCleaner visualizer={visualizer} />
              <Results
                visualizer={visualizer}
                mode={mode}
                pathAlgorithm={pathAlgorithm}
              />
            </>
          )}

          <Separator />

          <Section title="Board">
            <div className="flex flex-col gap-2">
              <Label htmlFor="wallAlgorithmChoices">Maze</Label>
              <div className="flex gap-2">
                <Select
                  value={wallAlgorithm}
                  onValueChange={value =>
                    setWallAlgorithm(value as MazeAlgorithmId)
                  }
                >
                  <SelectTrigger
                    id="wallAlgorithmChoices"
                    aria-label="Wall Algorithm Choices"
                    className="min-w-0 flex-1"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAZE_ALGORITHMS.map(({ id, label }) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!visualizer}
                  onClick={() => visualizer?.buildMaze(wallAlgorithm)}
                >
                  <BrickWallIcon /> Build Walls
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label id="paintModeLabel">Paint mode</Label>
              <Segmented
                label="Paint Mode"
                value={paintMode}
                onChange={setPaintMode}
                options={[
                  { value: 'wall', label: 'Wall' },
                  { value: 'weight', label: 'Weighted Terrain' },
                ]}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="speedControl">Animation speed</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {speed}%
                </span>
              </div>
              <Slider
                id="speedControl"
                aria-label="Animation speed"
                value={[speed]}
                min={0}
                max={100}
                onValueChange={([value]) => changeSpeed(value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!visualizer}
                onClick={() => visualizer?.resetPath()}
              >
                Reset Path
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!visualizer}
                onClick={() => visualizer?.resetAll()}
              >
                Reset All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!visualizer}
                onClick={() => {
                  if (!visualizer) return;
                  const { rows, columns } = visualizer.getSnapshot().grid;
                  visualizer.resetAll(randomAnchors(rows, columns));
                }}
              >
                Reset Start/Goal
              </Button>
            </div>
          </Section>
        </aside>
      </main>
    </div>
  );
};

// Results for whatever is on screen, the no-path error, and (in explore
// mode, before any run) the selected algorithm's walkthrough.
// Once the board is edited, a share link still in the address bar (from
// opening one, or from Share) no longer describes what's on screen:
// reloading would bring back the old board and drop the edits. So drop the
// fragment as soon as the board changes. Runs don't count - replaying the
// link's own run leaves it valid.
function StaleLinkCleaner({ visualizer }: { visualizer: Visualizer }) {
  const { boardRevision } = useVisualizerSnapshot(visualizer);
  // The revision the current board started at. A new visualizer (e.g. from a
  // pasted link) starts a new baseline - adjusted during render, React's
  // pattern for state derived from a changed prop.
  const [baseline, setBaseline] = React.useState({
    visualizer,
    revision: boardRevision,
  });
  if (baseline.visualizer !== visualizer) {
    setBaseline({ visualizer, revision: boardRevision });
  }
  const edited =
    baseline.visualizer === visualizer && boardRevision !== baseline.revision;
  React.useEffect(() => {
    if (edited && window.location.hash) {
      const { pathname, search } = window.location;
      window.history.replaceState(null, '', pathname + search);
    }
  }, [edited, boardRevision]);
  return null;
}

function Results({
  visualizer,
  mode,
  pathAlgorithm,
}: {
  visualizer: Visualizer;
  mode: ShareMode;
  pathAlgorithm: PathAlgorithmId;
}) {
  const { runs, error } = useVisualizerSnapshot(visualizer);
  const searching = runs.some(run => run.kind === 'search');
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        !searching && mode === 'race' && 'hidden'
      )}
    >
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {mode === 'race' ? (
        <RaceScoreboard visualizer={visualizer} />
      ) : searching ? (
        <ExploreResults visualizer={visualizer} />
      ) : (
        <HowItWorks algorithm={pathAlgorithm} phase={null} />
      )}
    </div>
  );
}

export default Workspace;
