import { useSyncExternalStore } from 'react';
import type { Player, PlayerState } from '../player/player';
import type { Visualizer, VisualizerSnapshot } from '../visualizer/visualizer';

/** Re-renders whenever the board or its run changes. */
export function useVisualizerSnapshot(
  visualizer: Visualizer
): VisualizerSnapshot {
  return useSyncExternalStore(visualizer.subscribe, visualizer.getSnapshot);
}

/** Re-renders on every playback change - every frame while playing. */
export function usePlayerState(player: Player): PlayerState {
  return useSyncExternalStore(player.subscribe, player.getState);
}
