# Pathfinding Visualizer

Welcome to my Pathfinding Visualizer! In a recent pursuit, I had been exposed to the world of AI path-finding, search, and wall-building. After that exposure, I decided that I need to explore the topic further, and solidify my understanding by building an app. I will continuously add to the application with more algorithms. In the meantime, please take a look and have fun!

You can access it here: https://enbattle.github.io/pathfinding-visualizer/

## Current Pathfinding Algorithm Selection
  - Dijkstra's Algorithm
  - A* Search
  - Greedy Best-first Search
  - Breath-first Search
  - Depth-first Search

## Current Wall-Building Algorithm Selection
  - Recursive Division
  - Twin Recursive Division

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which installs
dependencies, builds the production bundle, and publishes it to GitHub
Pages via `actions/deploy-pages`. This is the primary way the live site
gets updated - it doesn't force-push or need local GitHub credentials.

`npm run deploy` (which runs `gh-pages -d dist`) is still available as a
manual local fallback that builds and pushes the production bundle to a
`gh-pages` branch directly from your machine, for cases where you can't or
don't want to use GitHub Actions.

Pull requests and pushes to `main` are also checked by
`.github/workflows/ci.yml`, which runs the test suite and a production
build.