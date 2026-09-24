import { WEIGHTED_TERRAIN_COST } from '../engine';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

const TIPS: { title: string; body: string }[] = [
  {
    title: 'Explore',
    body: 'Pick an algorithm and press Visualize to watch it search. The panel shows its pseudocode with the step that is playing highlighted, and whether the path it found is the cheapest possible.',
  },
  {
    title: 'Race',
    body: 'Pick 2 to 4 algorithms and start a race. They search the same board side by side, one cell per step, so the first to reach the goal did the least work.',
  },
  {
    title: 'Playback',
    body: 'Pause, step, or drag the scrubber under the board to move through any run, forwards or backwards.',
  },
  {
    title: 'Edit the board',
    body: `Click or drag to paint walls or weighted terrain (entering it costs ${WEIGHTED_TERRAIN_COST} instead of 1); start a drag on a painted cell to erase. Drag S or G to move them - they pass over walls without erasing them. Once a path is shown, edits update it live. Build Walls generates a maze.`,
  },
  {
    title: 'Keyboard',
    body: 'Focus a board, move with the arrow keys, and press Space to paint or erase - or, on S or G, to pick it up and drop it.',
  },
  {
    title: 'Share',
    body: 'Share copies a link to this exact board and algorithm choice; opening it replays the run.',
  },
];

export function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>How to use the Pathfinding Visualizer</DialogTitle>
        <DialogDescription>
          See how search algorithms explore a grid, and how mazes are built.
        </DialogDescription>
        <dl className="flex flex-col gap-3 text-sm">
          {TIPS.map(tip => (
            <div key={tip.title}>
              <dt className="font-medium">{tip.title}</dt>
              <dd className="text-muted-foreground">{tip.body}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
