// Generates the images the repo ships: README screenshots (docs/images/),
// the link-preview image (public/og-image.jpg) and the app icons
// (public/icon-*.png). Not part of `npm run test:e2e`; run with
// `npm run assets` after a visible UI change, then review and commit.
import { readFileSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import {
  generateMaze,
  seededRandom,
  WEIGHTED_TERRAIN_COST,
} from '../src/engine';
import { encodeShare, type SharedState } from '../src/visualizer/share';
import { expect, finishPlayback, test, THREE_D_TIMEOUT } from './fixtures';

// A deterministic showcase board: a seeded Recursive Division maze with a
// band of weighted terrain, start bottom-left, goal top-right.
const ROWS = 23;
const COLUMNS = 47;
function showcaseLink(
  mode: SharedState['mode'],
  algorithms: SharedState['algorithms']
): string {
  const start = (ROWS - 2) * COLUMNS + 2;
  const goal = COLUMNS + COLUMNS - 3;
  const walls = new Uint8Array(ROWS * COLUMNS);
  for (const { index } of generateMaze(
    { rows: ROWS, columns: COLUMNS, start, goal },
    'recursive-division',
    seededRandom(11)
  )) {
    walls[index] = 1;
  }
  const weights = new Uint8Array(ROWS * COLUMNS).fill(1);
  for (let row = 8; row <= 14; row++) {
    for (let column = 18; column <= 28; column++) {
      const index = row * COLUMNS + column;
      if (!walls[index]) weights[index] = WEIGHTED_TERRAIN_COST;
    }
  }
  return `./#${encodeShare({ board: { rows: ROWS, columns: COLUMNS, start, goal, walls, weights }, mode, algorithms })}`;
}

async function shoot(page: Page, path: string) {
  await page.mouse.move(0, 0); // no hover states in the shot
  writeFileSync(path, await page.screenshot({ type: 'jpeg', quality: 85 }));
}

test.use({ viewport: { width: 1440, height: 900 } });

test('README: explore', async ({ page }) => {
  await page.goto(showcaseLink('explore', ['astar']));
  await finishPlayback(page);
  await expect(page.getByText('Path found', { exact: true })).toBeVisible();
  await shoot(page, 'docs/images/explore.jpg');
});

test('README: race', async ({ page }) => {
  await page.goto(showcaseLink('race', ['greedy', 'dijkstra', 'astar']));
  await finishPlayback(page);
  await shoot(page, 'docs/images/race.jpg');
});

test('README: 3D', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(showcaseLink('explore', ['dijkstra']));
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByRole('img', { name: /in 3D/ })).toBeVisible({
    timeout: THREE_D_TIMEOUT,
  });
  await finishPlayback(page);
  await page.waitForTimeout(500); // let the last frame render
  await shoot(page, 'docs/images/3d.jpg');
});

test.describe('link preview', () => {
  test.use({ viewport: { width: 1200, height: 630 } });
  test('og-image', async ({ page }) => {
    await page.goto(showcaseLink('explore', ['astar']));
    await finishPlayback(page);
    await shoot(page, 'public/og-image.jpg');
  });
});

// App icons, resized from the original artwork on a blank page (the app's
// CSP rightly blocks the data: image this needs). The maskable icon keeps
// the art inside the 80% safe zone on the theme background.
test('app icons', async ({ context }) => {
  const page = await context.newPage();
  const source = readFileSync('public/slime-icon.png').toString('base64');
  const icons = await page.evaluate(async base64 => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const render = (size: number, scale: number, background: string | null) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, size, size);
      }
      const drawn = size * scale;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        image,
        (size - drawn) / 2,
        (size - drawn) / 2,
        drawn,
        drawn
      );
      return canvas.toDataURL('image/png').split(',')[1];
    };
    return {
      'icon-192.png': render(192, 1, null),
      'icon-512.png': render(512, 1, null),
      'icon-maskable-512.png': render(512, 0.72, '#0b0e14'),
    };
  }, source);
  for (const [name, data] of Object.entries(icons)) {
    writeFileSync(`public/${name}`, Buffer.from(data, 'base64'));
  }
});
