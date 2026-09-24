import React from 'react';
import {
  MAZE_ALGORITHMS,
  PATH_ALGORITHMS,
  type MazeAlgorithmId,
  type PathAlgorithmId,
} from '../engine';
import { discoveredAt } from '../visualizer/runs';
import {
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
} from './configurations-helpers';
import { BoardCanvas } from './board-canvas';
import { PlaybackControls } from './playback-controls';
import { usePlayerState, useVisualizerSnapshot } from './use-visualizer';
import {
  BrickWallIcon,
  FlagIcon,
  Grid3x3Icon,
  InfoIcon,
  LaughIcon,
  RotateCcwIcon,
  RouteIcon,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const LEGEND_ITEMS: { label: string; swatchClassName: string }[] = [
  { label: 'Start / Goal', swatchClassName: 'legend-swatch-anchor' },
  { label: 'Wall', swatchClassName: 'legend-swatch-wall' },
  { label: 'Weighted terrain', swatchClassName: 'legend-swatch-weight' },
  { label: 'Visited', swatchClassName: 'legend-swatch-visited' },
  { label: 'Path', swatchClassName: 'legend-swatch-path' },
];

interface ConfigurationProps {
  /** Dependency injection point for tests (e.g. a fake animation clock). */
  createVisualizer?: (options: VisualizerOptions) => Visualizer;
}

const defaultCreateVisualizer = (options: VisualizerOptions) =>
  new Visualizer(options);

function randomAnchors(rows: number, columns: number) {
  return {
    start: toCellIndex(randomStartCoordinate(rows, columns), columns),
    goal: toCellIndex(randomGoalCoordinate(rows, columns), columns),
  };
}

const Configuration = ({
  createVisualizer = defaultCreateVisualizer,
}: ConfigurationProps) => {
  const [pathAlgorithm, setPathAlgorithm] =
    React.useState<PathAlgorithmId>('bfs');
  const [wallAlgorithm, setWallAlgorithm] =
    React.useState<MazeAlgorithmId>('recursive-division');
  const [paintMode, setPaintMode] = React.useState<PaintMode>('wall');
  const [speed, setSpeed] = React.useState<number>(DEFAULT_SPEED);
  const [openInfoModal, setOpenInfoModal] = React.useState<boolean>(false);

  // The board's rows/columns are chosen once, from the board area's
  // measured size, before the first paint; after that the canvas only
  // rescales to fit (see BoardCanvas).
  const boardAreaRef = React.useRef<HTMLDivElement>(null);
  const [visualizer, setVisualizer] = React.useState<Visualizer | null>(null);
  const initialSpeedRef = React.useRef(speed);
  React.useLayoutEffect(() => {
    const element = boardAreaRef.current;
    if (!element) return;
    // jsdom (the test environment) doesn't lay anything out, so a zero
    // size falls back to a window-based estimate.
    const { clientWidth, clientHeight } = element;
    const { rows, columns } =
      clientWidth > 0 && clientHeight > 0
        ? computeBoardSizeFromDimensions(clientWidth, clientHeight)
        : computeBoardSize();
    const created = createVisualizer({
      rows,
      columns,
      ...randomAnchors(rows, columns),
      rate: speedToRate(initialSpeedRef.current),
    });
    setVisualizer(created);
    return () => created.dispose();
  }, [createVisualizer]);

  const changeSpeed = (value: number) => {
    setSpeed(value);
    visualizer?.setRate(speedToRate(value));
  };

  return (
    <div className="flex min-h-screen flex-col items-start gap-4 p-4 lg:flex-row lg:gap-6 lg:p-6">
      {/* Menu Area */}
      <Card className="w-full shrink-0 gap-5 py-5 lg:w-[21rem]">
        <CardHeader className="gap-3 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Pathfinder Visualizer</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-help text-primary hover:bg-primary/10 hover:text-primary"
              aria-label="About this app"
              onClick={() => setOpenInfoModal(true)}
            >
              <InfoIcon className="h-5 w-5" />
            </Button>
          </div>

          {/* Legend */}
          <div
            className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
            aria-label="Cell color legend"
          >
            {LEGEND_ITEMS.map(item => (
              <div key={item.label} className="flex items-center gap-1">
                <span
                  className={cn('legend-swatch', item.swatchClassName)}
                  aria-hidden="true"
                />
                {item.label}
              </div>
            ))}
          </div>
        </CardHeader>

        <Dialog open={openInfoModal} onOpenChange={setOpenInfoModal}>
          <DialogContent aria-describedby="pathfinding-modal-description">
            <DialogTitle>
              Welcome to Pathfinding Visualizer!{' '}
              <LaughIcon className="inline h-6 w-6 align-text-bottom text-primary" />
            </DialogTitle>
            <div id="pathfinding-modal-description">
              <div>
                You can choose wall-building and path-finding algorithms and see
                them in action!
              </div>
              <div>Here is a list of options to help you get started:</div>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  To see the wall creation, please select a wall algorithm from
                  the dropdown and click on the "Build Walls" button.{' '}
                  <BrickWallIcon className="inline h-6 w-6 align-text-bottom text-primary" />
                </li>
                <li>
                  To see the finding of paths, please select a path algorithm
                  from the dropdown and click on the "Visualize" button.{' '}
                  <RouteIcon className="inline h-6 w-6 align-text-bottom text-primary" />
                </li>
                <li>
                  Pause, step through, or scrub any animation with the playback
                  controls above the board.
                </li>
                <li>
                  To reset the start and goal coordinates, click on the "Reset
                  Start/Goal" button.{' '}
                  <FlagIcon className="inline h-6 w-6 align-text-bottom text-primary" />
                </li>
                <li>
                  To reset the current path visualized, click on the "Reset
                  Path" button.{' '}
                  <RotateCcwIcon className="inline h-6 w-6 align-text-bottom text-primary" />
                </li>
                <li>
                  To reset the board, click on the "Reset All" button.{' '}
                  <RotateCcwIcon className="inline h-6 w-6 align-text-bottom text-primary" />
                </li>
                <li>
                  Drag the Start or Goal marker to move it anywhere on the
                  board.
                </li>
                <li>
                  Click, or click-and-drag, an empty cell to paint a wall or
                  weighted terrain, depending on the paint mode selected below
                  the wall algorithm.
                </li>
                <li>
                  Once a path is shown, editing the board updates it live.
                </li>
                <li>
                  Keyboard: focus the board, move with the arrow keys, and press
                  Space to paint or erase, or to pick up and drop S or G.
                </li>
              </ul>
            </div>
          </DialogContent>
        </Dialog>

        <CardContent className="flex flex-col gap-5 px-5">
          {/* Wall Algorithm type - Build Walls is this section's terminal
              action, so nothing else shares its row. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="wallAlgorithmChoices">Wall Algorithm</Label>
            <Select
              value={wallAlgorithm}
              // Radix only ever reports one of the SelectItem values below.
              onValueChange={value =>
                setWallAlgorithm(value as MazeAlgorithmId)
              }
            >
              <SelectTrigger
                id="wallAlgorithmChoices"
                aria-label="Wall Algorithm Choices"
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
              className="mt-1"
              disabled={!visualizer}
              onClick={() => visualizer?.buildMaze(wallAlgorithm)}
            >
              <BrickWallIcon /> Build Walls
            </Button>
          </div>

          <Separator />

          {/* Paint mode - what a manual click/drag on the board paints,
              independent of the wall algorithm above. */}
          <div className="flex flex-col gap-2">
            <Label id="paintModeLabel">Paint Mode</Label>
            <div
              role="group"
              aria-labelledby="paintModeLabel"
              className="inline-flex w-fit rounded-md border border-input bg-input/30 p-0.5"
            >
              <Button
                type="button"
                size="sm"
                variant={paintMode === 'wall' ? 'secondary' : 'ghost'}
                aria-pressed={paintMode === 'wall'}
                onClick={() => setPaintMode('wall')}
              >
                Wall
              </Button>
              <Button
                type="button"
                size="sm"
                variant={paintMode === 'weight' ? 'secondary' : 'ghost'}
                aria-pressed={paintMode === 'weight'}
                onClick={() => setPaintMode('weight')}
              >
                Weighted Terrain
              </Button>
            </div>
          </div>

          <Separator />

          {/* Speed control */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="speedControl">Animation Speed</Label>
              <span className="text-xs text-muted-foreground">{speed}%</span>
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

          <Separator />

          {/* Path Algorithm type */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="pathAlgorithmChoices">Path Algorithm</Label>
            <Select
              value={pathAlgorithm}
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
            <Button
              type="button"
              className="mt-1"
              disabled={!visualizer}
              onClick={() => visualizer?.visualize(pathAlgorithm)}
            >
              <RouteIcon /> Visualize
            </Button>
          </div>

          {visualizer && <RunSummary visualizer={visualizer} />}

          <Separator />

          <div className="flex flex-wrap gap-2">
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
          </div>
        </CardContent>
      </Card>

      {/* Board Area */}
      <Card className="min-h-[28rem] min-w-0 flex-1 gap-0 self-stretch overflow-hidden py-0">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Grid3x3Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Board</CardTitle>
          </div>
          {visualizer && <BoardHeader visualizer={visualizer} />}
        </CardHeader>
        <CardContent className="min-h-0 flex-1 p-0">
          {/* boardAreaRef measures this inner div's own content box (no
              padding of its own) to size the grid - the visual inset lives
              on this wrapper instead, so it never gets counted as part of
              the board's available space. */}
          <div className="h-full w-full bg-background/40 p-3">
            <div ref={boardAreaRef} className="h-full w-full">
              {visualizer && (
                <BoardCanvas visualizer={visualizer} paintMode={paintMode} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Board size, plus playback controls while a run is on screen.
function BoardHeader({ visualizer }: { visualizer: Visualizer }) {
  const { grid, run } = useVisualizerSnapshot(visualizer);
  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
      {run && (
        <div className="max-w-md min-w-0 flex-1">
          <PlaybackControls player={visualizer.player} runLength={run.length} />
        </div>
      )}
      <Badge variant="outline" className="font-normal text-muted-foreground">
        {grid.rows} × {grid.columns} cells
      </Badge>
    </div>
  );
}

// Stats for the search on screen (the visited count follows the
// playhead), and the no-path error.
function RunSummary({ visualizer }: { visualizer: Visualizer }) {
  const { run, error } = useVisualizerSnapshot(visualizer);
  const { tick } = usePlayerState(visualizer.player);
  const search = run?.kind === 'search' ? run : null;

  return (
    <>
      {search && (
        <div
          className="grid grid-cols-3 gap-2 rounded-md border border-border bg-muted/50 p-3 text-center"
          role="status"
        >
          <div>
            <div className="text-lg font-bold">
              {discoveredAt(search, tick)}
            </div>
            <div className="text-xs text-muted-foreground">Nodes visited</div>
          </div>
          <div>
            <div className="text-lg font-bold">
              {search.result.path?.length ?? '—'}
            </div>
            <div className="text-xs text-muted-foreground">Path length</div>
          </div>
          <div>
            <div className="text-lg font-bold">
              {`${search.searchMs.toFixed(2)}ms`}
            </div>
            <div className="text-xs text-muted-foreground">Algorithm time</div>
          </div>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}
    </>
  );
}

export default Configuration;
