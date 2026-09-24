import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production build (served by
// `vite preview`), so they exercise exactly what ships: the minified
// bundle, the lazy 3D chunk and the Content Security Policy.
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/pathfinding-visualizer/`;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /(mobile|assets)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // Headless Chromium has no GPU; SwiftShader gives it a software
        // WebGL implementation so the 3D view can really run.
        launchOptions: {
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
    {
      // Generates the README screenshots, link preview and icons: run on
      // demand with `npm run assets`, never as part of the test suite.
      name: 'assets',
      testMatch: /assets\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
    {
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    // Always build fresh: reusing a server left running could test a stale
    // build and pass for the wrong reason.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
