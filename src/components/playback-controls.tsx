import {
  PauseIcon,
  PlayIcon,
  SkipForwardIcon,
  StepBackIcon,
  StepForwardIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { Player } from '../player/player';
import { usePlayerState } from './use-visualizer';

interface PlaybackControlsProps {
  player: Player;
  /** Ticks in the run itself (the player's length also includes the final entrance animation). */
  runLength: number;
}

/** Play/pause, single-step, skip to end, and a scrubber for the current run. */
export function PlaybackControls({ player, runLength }: PlaybackControlsProps) {
  const { tick, length, playing } = usePlayerState(player);
  const step = Math.min(runLength, Math.ceil(tick));

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Playback">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Step back"
        onClick={() => player.step(-1)}
        disabled={tick <= 0}
      >
        <StepBackIcon />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => player.toggle()}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Step forward"
        onClick={() => player.step(1)}
        disabled={tick >= length}
      >
        <StepForwardIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Skip to end"
        onClick={() => player.finish()}
        disabled={tick >= length}
      >
        <SkipForwardIcon />
      </Button>
      <Slider
        aria-label="Playback position"
        className="mx-2 min-w-24 flex-1"
        min={0}
        max={Math.max(length, 1)}
        step={1}
        value={[tick]}
        onValueChange={([value]) => {
          player.pause();
          player.seek(value);
        }}
      />
      <span className="min-w-20 text-right text-xs text-muted-foreground tabular-nums">
        {step} / {runLength}
      </span>
    </div>
  );
}
