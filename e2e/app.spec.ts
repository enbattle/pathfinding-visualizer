import {
  finishPlayback,
  boardFingerprint,
  expect,
  expectCellColor,
  fixtureLink,
  FIXTURE,
  test,
} from './fixtures';

const board = (page: import('@playwright/test').Page) =>
  page.getByRole('application').first();

test('loads within the viewport and does not download the 3D view', async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto('./');
  await expect(board(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Visualize' })).toBeEnabled();

  // The page fits the viewport; the sidebar scrolls on its own.
  const overflow = await page.evaluate(() => ({
    vertical: document.documentElement.scrollHeight - window.innerHeight,
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(overflow).toEqual({ vertical: 0, horizontal: 0 });
  expect(scripts.some(url => url.includes('board-3d'))).toBe(false);
});

test('ships the Content Security Policy', async ({ page }) => {
  await page.goto('./');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("object-src 'none'");
});

test('builds a maze, then finds a path through it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Build Walls' }).click();
  await finishPlayback(page);
  // Every maze walls the outer border.
  await expectCellColor(page, { row: 0, column: 0 }, 'wall');

  await page.getByRole('button', { name: 'Visualize' }).click();
  await finishPlayback(page);
  const stats = page.getByRole('status', { name: 'Run statistics' });
  await expect(stats).toContainText('shortest');
  await expect(page.getByText('Path found')).toBeVisible();
});

test('a share link restores the board and replays its run', async ({
  page,
}, testInfo) => {
  await page.goto(fixtureLink('explore', ['astar']));
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible(); // replaying
  await finishPlayback(page);

  await expectCellColor(page, FIXTURE.start, 'start');
  await expectCellColor(page, FIXTURE.goal, 'goal');
  await expectCellColor(page, FIXTURE.wall, 'wall');
  // The only way around the wall is through the gap.
  await expectCellColor(page, FIXTURE.gap, 'path');
  await expect(
    page.getByRole('status', { name: 'Run statistics' })
  ).toContainText('shortest');
  await testInfo.attach('shared board', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('Share copies a link that reproduces the board', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await page.getByRole('button', { name: 'Build Walls' }).click();
  await finishPlayback(page);
  await expectCellColor(page, { row: 0, column: 0 }, 'wall');
  const original = await boardFingerprint(page);

  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByText('Link copied')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/#v=1&b=[\w-]+&m=explore&a=astar$/);

  const copy = await context.newPage();
  await copy.goto(link);
  await finishPlayback(copy);
  await copy.getByRole('button', { name: 'Reset Path' }).click();
  await expectCellColor(copy, { row: 0, column: 0 }, 'wall');
  expect(await boardFingerprint(copy)).toBe(original);
});

test('races three algorithms on one board', async ({ page }, testInfo) => {
  await page.goto(fixtureLink('race', ['greedy', 'dijkstra', 'astar']));
  await expect(page.getByRole('application')).toHaveCount(3);
  await finishPlayback(page);

  const standings = page.getByRole('status', { name: 'Race standings' });
  await expect(standings.getByRole('row')).toHaveCount(4); // header + 3
  await expect(standings.getByLabel('First')).toBeVisible();
  // Every racer's path must squeeze through the gap.
  for (const boardIndex of [0, 1, 2])
    await expectCellColor(page, FIXTURE.gap, 'path', boardIndex);
  await testInfo.attach('race', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('the board can be painted with the keyboard', async ({ page }) => {
  await page.goto(fixtureLink('explore', ['bfs']));
  await page.getByRole('button', { name: 'Reset Path' }).click();
  await board(page).focus();
  // The cursor starts on S; paint the cell above it.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await expectCellColor(
    page,
    { row: FIXTURE.start.row - 1, column: FIXTURE.start.column },
    'wall'
  );
  await expect(page.getByText(/Row 3, column 2: wall/)).toBeAttached();
});

test('the 3D view loads on demand, renders with WebGL, and survives toggling', async ({
  page,
}, testInfo) => {
  await page.goto(fixtureLink('explore', ['dijkstra']));
  const chunk = page.waitForResponse(
    response => response.url().includes('board-3d') && response.ok()
  );
  await page.getByRole('button', { name: '3D' }).click();
  await chunk;

  const view = page.getByRole('img', { name: /in 3D/ });
  await expect(view).toBeVisible();
  await expect(
    page.getByText(/needs WebGL|couldn't start|was lost/)
  ).toHaveCount(0);

  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: '2D' }).click();
    await page.getByRole('button', { name: '3D' }).click();
  }
  await expect(view).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await finishPlayback(page);
  await testInfo.attach('3D view', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('a broken share link falls back to a fresh board', async ({
  page,
  problems,
}) => {
  await page.goto('./#v=1&b=not-a-board');
  await expect(page.getByRole('alert')).toContainText(
    "Couldn't open the shared board"
  );
  await expect(board(page)).toBeVisible();
  expect(problems).toEqual([]);
});

// Radix's dialog and select lock page scrolling while open; this checks
// they work under the strict CSP (the problems fixture fails the test on
// any violation).
test('dialogs and menus work under the Content Security Policy', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'About this app' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('combobox', { name: 'Path Algorithm Choices' }).click();
  await page.getByRole('option', { name: 'Breadth-first Search' }).click();
  await expect(
    page.getByRole('combobox', { name: 'Path Algorithm Choices' })
  ).toHaveText('Breadth-first Search');
});
