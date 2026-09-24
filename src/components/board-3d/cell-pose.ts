import { mixColor, type BoardPalette, type CellLayer } from '../board-renderer';

// How each cell looks in the 3D view: a box of some height and color.
// Derived from the same cellLayer() the 2D renderer uses, so the two views
// always agree on what every cell is at every tick - only the drawing
// differs. Pure (no three.js), so it's unit-testable without WebGL.

/** Steps in the visited color ramp (matches the 2D renderer). */
const RAMP_STEPS = 24;

/** Heights in cell widths. */
export const HEIGHTS = {
  floor: 0.08,
  weight: 0.22,
  visited: 0.16,
  path: 0.3,
  anchor: 0.9,
  wall: 1,
  /** Extra height at the crest of a visited cell's ripple. */
  ripple: 0.42,
} as const;

export interface CellPose {
  readonly height: number;
  /** A CSS color string (hex or rgb()). */
  readonly color: string;
}

// Rises past its settled height and eases back down: 0 at progress 0,
// peaking mid-entrance, 0 again at progress 1.
const crest = (progress: number) => Math.sin(Math.PI * progress);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
// Entrance colors in 1/16ths of the animation (as in 2D), so the set of
// distinct colors - and the scene's color cache - stays small.
const colorStep = (progress: number) => Math.round(progress * 16) / 16;

export function cellPose(
  layer: CellLayer,
  palette: BoardPalette,
  { reducedMotion = false }: { reducedMotion?: boolean } = {}
): CellPose {
  // With reduced motion, cells appear in their settled state.
  const progressOf = (progress: number) => (reducedMotion ? 1 : progress);

  switch (layer.type) {
    case 'empty':
      return { height: HEIGHTS.floor, color: palette.empty };
    case 'weight':
      return { height: HEIGHTS.weight, color: palette.weightMark };
    case 'start':
      return { height: HEIGHTS.anchor, color: palette.start };
    case 'goal':
      return { height: HEIGHTS.anchor, color: palette.goal };
    case 'wall': {
      // Walls grow up out of the floor.
      const progress = progressOf(layer.progress);
      return {
        height:
          HEIGHTS.floor + (HEIGHTS.wall - HEIGHTS.floor) * easeOut(progress),
        color: palette.wall,
      };
    }
    case 'visited': {
      const progress = progressOf(layer.progress);
      // Quantized like the 2D ramp, so there are few distinct colors.
      const order =
        Math.round(layer.order * (RAMP_STEPS - 1)) / (RAMP_STEPS - 1);
      const settled = mixColor(palette.visitedNear, palette.visitedFar, order);
      const base = layer.weighted ? HEIGHTS.weight : HEIGHTS.visited;
      return {
        height: base + HEIGHTS.ripple * crest(progress),
        color:
          progress < 1
            ? mixColor(palette.visitedFlash, settled, colorStep(progress))
            : settled,
      };
    }
    case 'path': {
      const progress = progressOf(layer.progress);
      return {
        height:
          HEIGHTS.visited +
          (HEIGHTS.path - HEIGHTS.visited) * easeOut(progress),
        color:
          progress < 1
            ? mixColor(palette.pathFlash, palette.path, colorStep(progress))
            : palette.path,
      };
    }
  }
}
