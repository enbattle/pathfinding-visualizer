import {
  expect,
  expectCellColor,
  finishPlayback,
  fixtureLink,
  FIXTURE,
  test,
} from './fixtures';

// Runs on a phone-sized touch device (the "mobile" project).

test('fits a phone screen with no sideways scrolling', async ({ page }) => {
  await page.goto('./');
  const canvas = page.getByRole('application');
  await expect(canvas).toBeVisible();
  const { overflow, canvasRight } = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    canvasRight: document.querySelector('canvas')!.getBoundingClientRect()
      .right,
  }));
  expect(overflow).toBe(0);
  expect(canvasRight).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('tapping a cell paints it', async ({ page }) => {
  await page.goto(fixtureLink('explore', ['bfs']));
  await page.getByRole('button', { name: 'Reset Path' }).click();
  const canvas = page.getByRole('application');
  const box = (await canvas.boundingBox())!;
  const size = box.width / FIXTURE.columns;
  const target = { row: 1, column: 2 };
  await canvas.tap({
    position: { x: (target.column + 0.5) * size, y: (target.row + 0.5) * size },
  });
  await expectCellColor(page, target, 'wall');
});

test('tapping a race column header shows what it means', async ({ page }) => {
  await page.goto(fixtureLink('race', ['greedy', 'dijkstra', 'astar']));
  await finishPlayback(page);
  await page
    .getByRole('table', { name: 'Race standings' })
    .getByRole('button', { name: 'Cheapest' })
    .tap();
  await expect(page.getByRole('tooltip')).toContainText('cheapest possible');
});
