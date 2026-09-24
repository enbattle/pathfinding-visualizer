import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  expect,
  finishPlayback,
  fixtureLink,
  test,
  THREE_D_TIMEOUT,
} from './fixtures';

// Automated accessibility checks (axe-core, WCAG 2.1 A/AA rules) on each
// major state of the UI. Automated checks catch roughly a third of real
// issues, so this backs the "accessible" claim rather than proving it; the
// keyboard and screen-reader behavior has its own tests.
async function expectNoViolations(page: Page, state: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = violations.map(
    violation =>
      `${violation.id} (${violation.impact}): ${violation.help} - ${violation.nodes
        .slice(0, 3)
        .map(node => node.target.join(' '))
        .join(', ')}`
  );
  expect(summary, `accessibility violations: ${state}`).toEqual([]);
}

test('the initial page has no accessibility violations', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('application')).toBeVisible();
  await expectNoViolations(page, 'initial page');
});

test('a finished run with its stats and pseudocode has no violations', async ({
  page,
}) => {
  await page.goto(fixtureLink('explore', ['astar']));
  await finishPlayback(page);
  await expect(page.getByText('Path found', { exact: true })).toBeVisible();
  await expectNoViolations(page, 'explore results');
});

test('a race with standings has no violations', async ({ page }) => {
  await page.goto(fixtureLink('race', ['greedy', 'dijkstra', 'astar']));
  await finishPlayback(page);
  await expectNoViolations(page, 'race');
});

test('the About dialog has no violations', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'About this app' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoViolations(page, 'about dialog');
});

test('the 3D view has no violations', async ({ page }) => {
  await page.goto(fixtureLink('explore', ['bfs']));
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByRole('img', { name: /in 3D/ })).toBeVisible({
    timeout: THREE_D_TIMEOUT,
  });
  await expectNoViolations(page, '3D view');
});
