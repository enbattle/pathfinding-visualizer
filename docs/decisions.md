# Decisions

Choices that shaped this codebase, with the reasoning, so they aren't
re-litigated from scratch (by people or AI assistants). Each entry says
what would change the decision. Add an entry when you make a choice that
a reasonable reviewer might question or undo. Newest last.

## 1. The engine is pure TypeScript and returns data

**Decision:** `src/engine/` has no React, DOM or timers. Searches are
generators that yield events, and mazes return timed wall placements.

**Why:** the algorithms can then be tested exhaustively on their own
(property tests against naive reference solvers, ASCII snapshots). And
every view (2D canvas, race grid, 3D) reuses the same results.

**Revisit if:** never, in spirit. Keep new algorithms here.

## 2. Playback is a tick number, not timers

**Decision:** a run is precomputed as per-cell reveal ticks
(`src/visualizer/runs.ts`). The `Player` only moves a playhead, and every
frame is drawn from (snapshot, run, tick).

**Why:** pause, step, scrub and speed come for free, and nothing needs
cancelling on reset. The old timer-based animation had cancellation bugs.

**Revisit if:** a feature needs per-frame state that can't be derived
from the tick (so far, none has).

## 3. ESLint + Prettier, not Biome

**Decision:** keep ESLint (typescript-eslint, react-hooks v7) and add
Prettier.

**Why:** eslint-plugin-react-hooks v7 carries the React Compiler rules,
which Biome doesn't have. Losing them silently weakens hook checks.

**Revisit if:** Biome ships equivalent React Compiler diagnostics.

## 4. Canvas rendering; plain three.js for 3D (no React Three Fiber)

**Decision:** the board is a `<canvas>` drawn by a pure function, and the
3D view is an imperative three.js scene (`src/components/board-3d/`).

**Why:** both views are pure functions of (snapshot, run, tick), so a
declarative scene graph adds a reconciler and two dependencies for
nothing. One `InstancedMesh` draws the whole 3D board in one call.

**Revisit if:** the 3D view grows complex interactive object trees.

## 5. The 3D view is view-only

**Decision:** editing happens in 2D. In 3D, drag orbits and the wheel
zooms.

**Why:** orbit and paint compete for the same gesture, and in 2D a
pointer maps to exactly one cell.

**Revisit if:** users ask to edit in 3D (raycasting onto the floor would
work, with a mode toggle).

## 6. e2e tests assert canvas colors, not screenshot diffs

**Decision:** Playwright tests sample exact fill colors at cell centers
(`expectCellColor` in `e2e/fixtures.ts`). Screenshots are only attached
for humans.

**Why:** canvas fills are identical on every OS and GPU, while pixel
diffs of whole screenshots aren't (fonts, anti-aliasing). This needs no
baselines to maintain.

**Revisit if:** layout regressions slip through that sampled colors
can't see.

## 7. The CSP allows inline styles

**Decision:** `style-src 'self' 'unsafe-inline'`; scripts stay
`'self'` only (`vite.config.ts`).

**Why:** Radix's scroll lock injects `<style>` elements with computed
values, so hashes can't work, and a static host can't mint nonces.
Inline CSS can't execute code, and React escapes all rendered text.

**Revisit if:** the host can set headers with per-request nonces, or
the UI drops Radix's scroll lock.

## 8. Benchmarks are report-only

**Decision:** `npm run bench` runs in CI and posts its numbers to the run
summary, but never fails the build.

**Why:** timings on shared CI runners vary too much to gate on small
changes. Absolute numbers also include Vitest module-runner overhead.

**Revisit if:** CI gets dedicated, stable runners.

## 9. TypeScript 7 and the React Compiler are deferred

**Decision:** stay on TypeScript 6.0.x (Dependabot ignores `>=6.1`), and
don't enable the React Compiler.

**Why:** typescript-eslint requires TypeScript `<6.1`. The hot paths
are canvas/WebGL renderers that React doesn't re-render, so the compiler
would add a build step for little gain.

**Revisit if:** typescript-eslint widens its TypeScript range (then lift
the Dependabot ignore), or React re-rendering shows up in a profile.

## 10. Markers on the border are routed into the interior

**Decision:** when start or goal sits on the outer border, maze
generation keeps a short straight route from it to its nearest interior
cell open (`anchorRoute` in `src/engine/mazes.ts`).

**Why:** a marker can be dragged or shared onto the border, and the
border walls would otherwise seal it in. Found by an independent audit;
interior mazes are unchanged.

**Revisit if:** markers are ever restricted to interior cells instead.

## 11. GitHub Actions is the only deploy path

**Decision:** `.github/workflows/deploy.yml` deploys to GitHub Pages only
after CI succeeds for a push to `main`, and deploys exactly the commit CI
tested. The `gh-pages` package and the local deploy scripts were removed.

**Why:** the manual local fallback was unused, and a second path could
publish a build CI never checked. Now nothing CI rejected can ship.

**Revisit if:** the site moves off GitHub Pages, or a release ever has to
bypass CI.

## 12. Icons come from lucide-react

**Decision:** every icon is from `lucide-react`; `react-icons` is not a
dependency.

**Why:** `react-icons` was in use across five different icon packs, which
mixed visual styles. Lucide is shadcn's default icon set, and
`components.json` points at it.

**Revisit if:** a needed icon doesn't exist in Lucide.
