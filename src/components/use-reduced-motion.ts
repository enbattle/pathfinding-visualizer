import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return (
    typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches
  );
}

/**
 * Whether the user asked the OS for reduced motion. When true, boards skip
 * entrance animations (cells appear settled) and the 3D camera stops
 * gliding; playback itself still steps cell by cell.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
