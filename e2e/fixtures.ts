import { test as base, expect, type Page } from '@playwright/test';
import { encodeShare, type SharedState } from '../src/visualizer/share';

// Every test fails if the page logs an error, throws, or violates the
// Content Security Policy - so each test also checks those.
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', message => {
        if (message.type() === 'error')
          problems.push(`console: ${message.text()}`);
      });
      page.on('pageerror', error =>
        problems.push(`pageerror: ${error.message}`)
      );
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', event => {
          console.error(
            `CSP violation: ${event.violatedDirective} blocked ${event.blockedURI || 'inline'}`
          );
        });
      });
      await use(problems);
      expect(
        problems,
        'errors, exceptions or CSP violations on the page'
      ).toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/**
 * A small deterministic board: 7x11, start (3,1), goal (3,9), and a wall
 * down column 5 except its bottom cell - so every shortest path goes
 * through the gap at (6,5).
 */
export const FIXTURE = {
  rows: 7,
  columns: 11,
  start: { row: 3, column: 1 },
  goal: { row: 3, column: 9 },
  gap: { row: 6, column: 5 },
  wall: { row: 0, column: 5 },
};

export function fixtureLink(
  mode: SharedState['mode'],
  algorithms: SharedState['algorithms']
): string {
  const { rows, columns } = FIXTURE;
  const walls = new Uint8Array(rows * columns);
  for (let row = 0; row < rows - 1; row++) walls[row * columns + 5] = 1;
  const fragment = encodeShare({
    board: {
      rows,
      columns,
      start: FIXTURE.start.row * columns + FIXTURE.start.column,
      goal: FIXTURE.goal.row * columns + FIXTURE.goal.column,
      walls,
      weights: new Uint8Array(rows * columns).fill(1),
    },
    mode,
    algorithms,
  });
  return `./#${fragment}`;
}

export type BoardColor = 'empty' | 'wall' | 'start' | 'goal' | 'path';

// The CSS custom property holding each color (index.css), read from the
// page so the tests follow the theme instead of hard-coding it.
const COLOR_VARIABLES: Record<BoardColor, string> = {
  empty: '--board-empty',
  wall: '--board-wall',
  start: '--board-start',
  goal: '--board-goal',
  path: '--board-path',
};

/**
 * Waits until a 2D board canvas shows `color` in cell (row, column).
 * Samples a point inside the cell but away from its center, which the path
 * line and the S/G labels cover. Canvas fills are exact on every
 * platform, so this is deterministic in a way screenshot diffs aren't.
 */
export async function expectCellColor(
  page: Page,
  cell: { row: number; column: number },
  color: BoardColor,
  boardIndex = 0
): Promise<void> {
  await page.waitForFunction(
    ({ cell, variable, boardIndex }) => {
      const canvas = document.querySelectorAll<HTMLCanvasElement>(
        'canvas[role=application]'
      )[boardIndex];
      if (!canvas) return false;
      const [, rows, columns] =
        /(\d+) rows by (\d+) columns/.exec(
          canvas.getAttribute('aria-label') ?? ''
        ) ?? [];
      const size = canvas.width / Number(columns);
      if (!size || Number(rows) * size !== canvas.height) return false;
      const [r, g, b] = canvas
        .getContext('2d')!
        .getImageData(
          Math.floor((cell.column + 0.22) * size),
          Math.floor((cell.row + 0.22) * size),
          1,
          1
        ).data;
      const hex = getComputedStyle(document.documentElement)
        .getPropertyValue(variable)
        .trim();
      const want = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      return [r, g, b].every((channel, i) => Math.abs(channel - want[i]) <= 3);
    },
    { cell, variable: COLOR_VARIABLES[color], boardIndex },
    { timeout: 10_000 }
  );
}

/** One sample color per cell of the first board, for comparing boards. */
export async function boardFingerprint(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[role=application]'
    )!;
    const [, rows, columns] = /(\d+) rows by (\d+) columns/.exec(
      canvas.getAttribute('aria-label') ?? ''
    )!;
    const size = canvas.width / Number(columns);
    const ctx = canvas.getContext('2d')!;
    const out: string[] = [];
    for (let row = 0; row < Number(rows); row++) {
      for (let column = 0; column < Number(columns); column++) {
        const [r, g, b] = ctx.getImageData(
          Math.floor((column + 0.22) * size),
          Math.floor((row + 0.22) * size),
          1,
          1
        ).data;
        out.push(`${r},${g},${b}`);
      }
    }
    return `${rows}x${columns}:${out.join(' ')}`;
  });
}

/**
 * Brings the current run to its end: skips ahead if it's still playing
 * (small boards can finish on their own before a test gets there), then
 * waits until playback has stopped at the end.
 */
export async function finishPlayback(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: 'Skip to end' });
  // Retried as a whole: under load a click can miss its moment (the run
  // may end between checking and clicking), so keep trying until the
  // button reports playback finished.
  await expect(async () => {
    if (await skip.isEnabled()) await skip.click({ timeout: 2_000 });
    await expect(skip).toBeDisabled({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}
