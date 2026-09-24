import React from 'react';
import BoardMemo, { type RunStats } from './board';
import {
  MAZE_ALGORITHMS,
  PATH_ALGORITHMS,
  type MazeAlgorithmId,
  type PathAlgorithmId,
} from '../engine';
import type { CoordinateAndDirection } from '../models/models';
import {
  computeBoardSize,
  computeBoardSizeFromDimensions,
  randomStartCoordinate,
  randomGoalCoordinate,
  speedToStepDelay,
  DEFAULT_SPEED,
} from './configurations-helpers';
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

const Configuration = () => {
  // Board size/start/goal all start unset and are seeded together, once,
  // from boardAreaRef's own *measured* content box - not from
  // window.innerWidth/innerHeight, which ignores the side panel/padding/
  // gaps around the board and always overestimates its actual available
  // space (that mismatch is what used to make the board overflow its
  // container and force a page scrollbar on every load).
  //
  // This has to be a "mount BoardMemo only once we already know the right
  // size" gate rather than "mount with a guess, then correct it": once
  // mounted, BoardMemo's own memo comparator (see BoardConfigurationsAreEqual
  // in board.tsx) deliberately ignores rows/columns, so a later correction
  // would silently no-op and the board would keep whatever size it first
  // mounted with regardless. Gating the mount on a real measurement instead
  // means there's only ever one, already-correct, mount.
  const [boardSize, setBoardSize] = React.useState<{
    rows: number;
    columns: number;
  } | null>(null);
  const [startCoordinate, setStartCoordinate] =
    React.useState<CoordinateAndDirection | null>(null);
  const [goalCoordinate, setGoalCoordinate] =
    React.useState<CoordinateAndDirection | null>(null);
  const boardAreaRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const element = boardAreaRef.current;
    if (!element) return;

    // jsdom (this project's test environment) never actually lays elements
    // out, so clientWidth/clientHeight here are always 0 - falling back to
    // the coarser window-based guess in that case is what keeps tests'
    // synchronous render() calls seeing a board immediately, instead of
    // waiting on a real layout measurement that will never arrive there.
    const { clientWidth, clientHeight } = element;
    const size =
      clientWidth > 0 && clientHeight > 0
        ? computeBoardSizeFromDimensions(clientWidth, clientHeight)
        : computeBoardSize();

    setBoardSize(size);
    setStartCoordinate(randomStartCoordinate(size.rows, size.columns));
    setGoalCoordinate(randomGoalCoordinate(size.rows, size.columns));
  }, []);

  // Derived, fallback-safe view of the board size for use before the
  // measurement above has run (e.g. the dimensions badge's very first
  // render) - BoardMemo itself only ever renders with the real,
  // non-fallback boardSize (see the guard around it below).
  const rows = boardSize?.rows ?? 20;
  const columns = boardSize?.columns ?? 20;

  // Initialize board states
  const [pathAlgorithm, setPathAlgorithm] =
    React.useState<PathAlgorithmId>('bfs');
  const [wallAlgorithm, setWallAlgorithm] =
    React.useState<MazeAlgorithmId>('recursive-division');
  const [paintMode, setPaintMode] = React.useState<'wall' | 'weight'>('wall');
  const [speed, setSpeed] = React.useState<number>(DEFAULT_SPEED);
  const [shouldBuildWalls, setShouldBuildWalls] =
    React.useState<boolean>(false);
  const [shouldVisualizePathAlgorithm, setShouldVisualizePathAlgorithm] =
    React.useState<boolean>(false);
  const [shouldResetBoard, setShouldResetBoard] =
    React.useState<boolean>(false);
  const [shouldResetPath, setShouldResetPath] = React.useState<boolean>(false);

  // Info Modal state
  const [openInfoModal, setOpenInfoModal] = React.useState<boolean>(false);

  // Algorithm-run error state (e.g. no path found)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Live run stats (nodes visited, path length, algorithm time)
  const [stats, setStats] = React.useState<RunStats | null>(null);

  const stepDelay = speedToStepDelay(speed);

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
              onClick={() => {
                setOpenInfoModal(true);
              }}
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
                  To reset the the board, click on the "Reset All" button.{' '}
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
              onClick={() => setShouldBuildWalls(true)}
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
              onValueChange={([value]) => setSpeed(value)}
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
              onClick={() => setShouldVisualizePathAlgorithm(true)}
            >
              <RouteIcon /> Visualize
            </Button>
          </div>

          {stats && (
            <div
              className="grid grid-cols-3 gap-2 rounded-md border border-border bg-muted/50 p-3 text-center"
              role="status"
            >
              <div>
                <div className="text-lg font-bold">{stats.visitedCount}</div>
                <div className="text-xs text-muted-foreground">
                  Nodes visited
                </div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {stats.pathLength ?? '—'}
                </div>
                <div className="text-xs text-muted-foreground">Path length</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {stats.algorithmTimeMs >= 0
                    ? `${stats.algorithmTimeMs.toFixed(2)}ms`
                    : '…'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Algorithm time
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setStartCoordinate(randomStartCoordinate(rows, columns));
                setGoalCoordinate(randomGoalCoordinate(rows, columns));
                setErrorMessage(null);
                setStats(null);
                setShouldResetBoard(true);
              }}
            >
              Reset Start/Goal
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setErrorMessage(null);
                setStats(null);
                setShouldResetPath(true);
              }}
            >
              Reset Path
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setErrorMessage(null);
                setStats(null);
                setShouldResetBoard(true);
              }}
            >
              Reset All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Board Area */}
      <Card className="min-h-[28rem] min-w-0 flex-1 gap-0 self-stretch overflow-hidden py-0">
        <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Grid3x3Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Board</CardTitle>
          </div>
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            {rows} × {columns} cells
          </Badge>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 p-0">
          {/* boardAreaRef measures this inner div's own content box (no
					    padding of its own) to size the grid - the visual inset
					    lives on this wrapper instead, so it never gets counted as
					    part of the board's available space. */}
          <div className="h-full w-full bg-background/40 p-3">
            {/* Always rendered (even before boardSize resolves) - the
						    layout effect above needs this element mounted so it has
						    something to measure in the first place. */}
            <div
              ref={boardAreaRef}
              className="board-scroll h-full w-full overflow-auto"
            >
              {boardSize && startCoordinate && goalCoordinate && (
                <BoardMemo
                  rows={boardSize.rows}
                  columns={boardSize.columns}
                  startCoordinate={startCoordinate}
                  goalCoordinate={goalCoordinate}
                  pathAlgorithm={pathAlgorithm}
                  wallAlgorithm={wallAlgorithm}
                  paintMode={paintMode}
                  stepDelay={stepDelay}
                  shouldBuildWalls={shouldBuildWalls}
                  setShouldBuildWalls={setShouldBuildWalls}
                  shouldVisualizePathAlgorithm={shouldVisualizePathAlgorithm}
                  setShouldVisualizePathAlgorithm={
                    setShouldVisualizePathAlgorithm
                  }
                  shouldResetBoard={shouldResetBoard}
                  setShouldResetBoard={setShouldResetBoard}
                  shouldResetPath={shouldResetPath}
                  setShouldResetPath={setShouldResetPath}
                  onError={setErrorMessage}
                  onStats={setStats}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Configuration;
