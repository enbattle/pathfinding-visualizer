import React from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { animationTicks, type Visualizer } from '../../visualizer/visualizer';
import { readPalette } from '../board-renderer';
import { usePrefersReducedMotion } from '../use-reduced-motion';
import { BoardScene, supportsWebGL } from './board-scene';

interface Board3DProps {
  visualizer: Visualizer;
  /** Which of the snapshot's runs this board shows (races show several). */
  runIndex?: number;
  label?: string;
}

/**
 * The 3D view of a board. Loaded lazily (it pulls in three.js), and a
 * viewing mode only: drag to orbit, scroll or pinch to zoom; editing stays
 * in the 2D view.
 *
 * Renders on demand - when the board, the playhead, the camera or the size
 * changes - rather than every frame, and keeps rendering only while the
 * camera is still gliding to a stop.
 */
export default function Board3D({
  visualizer,
  runIndex = 0,
  label = 'Board',
}: Board3DProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [supported] = React.useState(supportsWebGL);
  // The GPU can drop a WebGL context at any time (driver reset, too many
  // contexts); when it does, offer to rebuild the scene.
  const [contextLost, setContextLost] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { rows, columns } = visualizer.getSnapshot().grid;
  const ariaLabel = `${label} in 3D, ${rows} rows by ${columns} columns. Drag to orbit, scroll to zoom; with focus, arrow keys pan and Shift+arrow keys rotate. Switch to 2D to edit.`;

  React.useEffect(() => {
    const container = containerRef.current;
    if (!supported || contextLost || !container) return;

    // Every scene gets a brand-new canvas. Disposing a scene deliberately
    // loses its WebGL context, and a canvas whose context was lost can
    // never create a working one again - so reusing the element (as happens
    // when this effect re-runs, and on every mount under React's
    // development-mode double effects) would hand the next scene a dead
    // context.
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.tabIndex = 0; // focusable, so the keyboard can orbit too
    canvas.setAttribute('aria-label', ariaLabel);
    canvas.className =
      'absolute inset-0 h-full w-full cursor-grab touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing';
    container.appendChild(canvas);

    const scene = new BoardScene(canvas, rows, columns, readPalette(canvas), {
      reducedMotion,
    });
    const controls = new OrbitControls(scene.camera, canvas);
    controls.enableDamping = !reducedMotion;
    controls.listenToKeyEvents(canvas);
    controls.maxPolarAngle = Math.PI * 0.44; // never look from under the floor
    const span = Math.max(rows, columns);
    controls.minDistance = span * 0.35;
    controls.maxDistance = span * 2.5;

    // Only re-pose the cells when the board or playhead actually changed;
    // camera moves just re-render.
    let posedVersion = -1;
    let posedTick = -1;
    let frame: number | null = null;
    const draw = () => {
      frame = null;
      const cameraMoving = controls.update();
      const snapshot = visualizer.getSnapshot();
      const { tick, rate } = visualizer.player.getState();
      if (snapshot.version !== posedVersion || tick !== posedTick) {
        posedVersion = snapshot.version;
        posedTick = tick;
        scene.update(
          snapshot,
          snapshot.runs[runIndex] ?? null,
          tick,
          reducedMotion ? 0 : animationTicks(rate)
        );
      }
      scene.render();
      if (cameraMoving) requestDraw();
    };
    const requestDraw = () => {
      if (frame === null) frame = requestAnimationFrame(draw);
    };

    const resize = () => {
      scene.setSize(
        Math.max(1, container.clientWidth),
        Math.max(1, container.clientHeight),
        Math.min(window.devicePixelRatio || 1, 2)
      );
      requestDraw();
    };
    resize();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(container);
    controls.addEventListener('change', requestDraw);
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    const unsubscribeBoard = visualizer.subscribe(requestDraw);
    const unsubscribePlayer = visualizer.player.subscribe(requestDraw);

    return () => {
      // Before dispose(), which deliberately loses the context itself.
      canvas.removeEventListener('webglcontextlost', onContextLost);
      unsubscribeBoard();
      unsubscribePlayer();
      controls.removeEventListener('change', requestDraw);
      observer?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      controls.stopListenToKeyEvents();
      controls.dispose();
      scene.dispose();
      canvas.remove();
    };
  }, [
    visualizer,
    runIndex,
    rows,
    columns,
    supported,
    reducedMotion,
    contextLost,
    ariaLabel,
  ]);

  if (!supported) {
    return (
      <div
        role="status"
        className="grid h-full place-items-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
      >
        The 3D view needs WebGL, which isn't available in this browser. The 2D
        view works everywhere.
      </div>
    );
  }

  if (contextLost) {
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
      >
        The graphics context for the 3D view was lost.
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-accent"
          onClick={() => setContextLost(false)}
        >
          Restart 3D view
        </button>
      </div>
    );
  }

  return (
    // The effect above adds (and removes) the canvas itself.
    <div ref={containerRef} className="relative h-full min-h-0 w-full" />
  );
}
