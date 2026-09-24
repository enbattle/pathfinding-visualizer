import { describe, it, expect, afterEach } from 'vitest';
import {
  computeBoardSize,
  randomStartCoordinate,
  randomGoalCoordinate,
  speedToStepDelay,
  speedToRate,
  CELL_SIZE_PX,
  MIN_STEP_DELAY,
  MAX_STEP_DELAY,
} from './configurations-helpers';

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    configurable: true,
    writable: true,
  });
}

describe('speedToStepDelay', () => {
  it('maps the maximum speed (100) to the minimum step delay', () => {
    expect(speedToStepDelay(100)).toBe(MIN_STEP_DELAY);
  });

  it('maps the minimum speed (0) to the maximum step delay', () => {
    expect(speedToStepDelay(0)).toBe(MAX_STEP_DELAY);
  });

  it('is monotonically non-increasing as speed increases', () => {
    let previous = speedToStepDelay(0);
    for (let speed = 10; speed <= 100; speed += 10) {
      const current = speedToStepDelay(speed);
      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });
});

describe('speedToRate', () => {
  it('is the step rate per second for the step delay', () => {
    expect(speedToRate(100)).toBe(1000 / MIN_STEP_DELAY);
    expect(speedToRate(0)).toBe(1000 / MAX_STEP_DELAY);
  });
});

describe('computeBoardSize', () => {
  afterEach(() => {
    setViewport(1024, 768);
  });

  it('divides the viewport by CELL_SIZE_PX to compute rows/columns', () => {
    // Large enough viewport that the >=20 floor never kicks in, so the
    // division math itself is what's under test.
    setViewport(CELL_SIZE_PX * 50, CELL_SIZE_PX * 40);
    const { rows, columns } = computeBoardSize();
    expect(rows).toBe(40);
    expect(columns).toBe(50);
  });

  it('clamps to a minimum of 20 rows/columns on a small viewport', () => {
    setViewport(100, 100);
    const { rows, columns } = computeBoardSize();
    expect(rows).toBe(20);
    expect(columns).toBe(20);
  });

  it('does not clamp a dimension that is already above the floor while the other is small', () => {
    setViewport(CELL_SIZE_PX * 35, 100);
    const { rows, columns } = computeBoardSize();
    expect(rows).toBe(20);
    expect(columns).toBe(35);
  });
});

describe('randomStartCoordinate / randomGoalCoordinate', () => {
  const rows = 20;
  const columns = 20;
  const TRIALS = 100;

  it('always places start one cell inside the bottom border (row = rows - 2) - regression lock for the border-connectivity fix', () => {
    for (let i = 0; i < TRIALS; i++) {
      const start = randomStartCoordinate(rows, columns);
      expect(start.row).toBe(rows - 2);
      expect(start.column).toBeGreaterThanOrEqual(1);
      expect(start.column).toBeLessThanOrEqual(Math.floor(columns / 2));
    }
  });

  it('always places goal one cell inside the top border (row = 1) - regression lock for the border-connectivity fix', () => {
    for (let i = 0; i < TRIALS; i++) {
      const goal = randomGoalCoordinate(rows, columns);
      expect(goal.row).toBe(1);
      expect(goal.column).toBeGreaterThanOrEqual(Math.floor(columns / 2));
      expect(goal.column).toBeLessThanOrEqual(columns - 2);
    }
  });
});
