# Pathfinding Visualizer

Welcome to my Pathfinding Visualizer! In a recent pursuit, I had been exposed to the world of AI path-finding, search, and wall-building. After that exposure, I decided that I need to explore the topic further, and solidify my understanding by building an app. I will continuously add to the application with more algorithms. In the meantime, please take a look and have fun!

You can access it here: https://enbattle.github.io/pathfinding-visualizer/

## Features

- **Explore**: watch one algorithm search, with its pseudocode highlighted
  step by step, live stats, and a check of whether its path is the
  cheapest possible.
- **Race**: run 2–4 algorithms side by side on the same board, one cell
  per step each, with live standings: who reached the goal with the least
  work, and whose path is actually shortest.
- **Playback**: pause, step, and scrub any run forwards or backwards.
- **Live editing**: paint walls and weighted terrain, drag start/goal, or
  generate a maze; once a path is shown, edits update it instantly.
- **Share**: copy a link that reopens the exact board and replays the run.
- **3D view**: watch any run (or race) as a 3D scene. Walls rise, visited
  cells ripple, and the path glows; orbit and zoom freely. It loads only
  when you open it.
- **Accessible**: the board is keyboard-operable (arrow keys, Space) and
  announces the cell under the cursor to screen readers; animations
  respect `prefers-reduced-motion`.

## Current Pathfinding Algorithm Selection

- Dijkstra's Algorithm
- A* Search
- Greedy Best-first Search
- Breadth-first Search
- Depth-first Search

## Current Wall-Building Algorithm Selection

- Recursive Division
- Twin Recursive Division
- Prim's Algorithm

## Development

Requires Node 22+.

```bash
npm install
npm run dev          # local dev server
npm run lint         # ESLint
npm run format       # Prettier (write); format:check verifies only
npm run typecheck    # tsc
npm run test:run     # Vitest unit + component tests (npm test for watch mode)
npm run build        # production bundle in dist/
npm run check:bundle # bundle size budgets (after build)
npm run test:e2e     # Playwright end-to-end tests against the production build
npm run bench        # engine benchmarks
```

The first time you run the e2e tests, install their browser with
`npx playwright install chromium`.

## Architecture

The algorithms live in a pure-TypeScript engine (`src/engine/`) that the
React UI only animates. It is tested with property-based tests against
naive reference solvers, plus readable ASCII snapshot tests. See
[docs/architecture.md](docs/architecture.md).

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which installs
dependencies, builds the production bundle, and publishes it to GitHub
Pages via `actions/deploy-pages`. It can also be re-run manually from the
Actions tab (`workflow_dispatch`).

Pull requests and pushes to `main` are also checked by
`.github/workflows/ci.yml`: formatting, lint (zero warnings), typecheck,
unit tests, a production build with bundle budgets, `npm audit`,
Playwright end-to-end tests (report uploaded as an artifact), and engine
benchmarks (shown in the run summary). The deploy workflow re-runs the
key checks before publishing. Dependabot opens grouped weekly update PRs
for npm packages and the SHA-pinned GitHub Actions.
