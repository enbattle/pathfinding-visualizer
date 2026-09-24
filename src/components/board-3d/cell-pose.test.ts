import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mixColor, readPalette, type CellLayer } from '../board-renderer';
import { cellPose, HEIGHTS } from './cell-pose';

const palette = readPalette(document.body); // jsdom: the fallback palette

describe('cellPose', () => {
  it('gives each settled cell type its height and color', () => {
    expect(cellPose({ type: 'empty' }, palette)).toEqual({
      height: HEIGHTS.floor,
      color: palette.empty,
    });
    expect(cellPose({ type: 'start' }, palette)).toEqual({
      height: HEIGHTS.anchor,
      color: palette.start,
    });
    expect(cellPose({ type: 'goal' }, palette)).toEqual({
      height: HEIGHTS.anchor,
      color: palette.goal,
    });
    expect(cellPose({ type: 'wall', progress: 1 }, palette)).toEqual({
      height: HEIGHTS.wall,
      color: palette.wall,
    });
    expect(
      cellPose({ type: 'path', progress: 1, weighted: false }, palette)
    ).toEqual({
      height: HEIGHTS.path,
      color: palette.path,
    });
  });

  it('grows walls up out of the floor', () => {
    expect(cellPose({ type: 'wall', progress: 0 }, palette).height).toBe(
      HEIGHTS.floor
    );
    const half = cellPose({ type: 'wall', progress: 0.5 }, palette).height;
    expect(half).toBeGreaterThan(HEIGHTS.floor);
    expect(half).toBeLessThan(HEIGHTS.wall);
  });

  it('ripples visited cells up and back down, settling on the color ramp', () => {
    const visited = (progress: number, order = 0): CellLayer => ({
      type: 'visited',
      progress,
      weighted: false,
      order,
    });
    expect(cellPose(visited(0), palette).height).toBeCloseTo(HEIGHTS.visited);
    expect(cellPose(visited(0.5), palette).height).toBeCloseTo(
      HEIGHTS.visited + HEIGHTS.ripple
    );
    expect(cellPose(visited(1), palette).height).toBeCloseTo(HEIGHTS.visited);
    expect(cellPose(visited(1, 0), palette).color).toBe(
      mixColor(palette.visitedNear, palette.visitedFar, 0)
    );
    expect(cellPose(visited(1, 1), palette).color).toBe(
      mixColor(palette.visitedNear, palette.visitedFar, 1)
    );
  });

  it('keeps weighted terrain raised under the visited overlay', () => {
    const pose = cellPose(
      { type: 'visited', progress: 1, weighted: true, order: 0 },
      palette
    );
    expect(pose.height).toBeCloseTo(HEIGHTS.weight);
  });

  it('with reduced motion, every cell appears already settled', () => {
    const settled = { reducedMotion: true };
    expect(
      cellPose({ type: 'wall', progress: 0.1 }, palette, settled).height
    ).toBe(HEIGHTS.wall);
    expect(
      cellPose(
        { type: 'visited', progress: 0.5, weighted: false, order: 0 },
        palette,
        settled
      ).height
    ).toBeCloseTo(HEIGHTS.visited);
  });

  // The 3D scene caches one three.js Color per distinct color string, so
  // the set of colors cellPose can produce must stay small.
  it('only ever produces a small, bounded set of colors', () => {
    const colors = new Set<string>();
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.constantFrom('visited', 'path', 'wall'),
        (progress, order, type) => {
          const layer: CellLayer =
            type === 'visited'
              ? { type, progress, weighted: false, order }
              : type === 'path'
                ? { type, progress, weighted: false }
                : { type, progress };
          const { height, color } = cellPose(layer, palette);
          expect(Number.isFinite(height) && height > 0).toBe(true);
          colors.add(color);
        }
      ),
      { numRuns: 2000 }
    );
    // 24 ramp steps x 17 entrance steps, plus path and wall colors.
    expect(colors.size).toBeLessThanOrEqual(24 * 17 + 17 + 1);
  });
});
