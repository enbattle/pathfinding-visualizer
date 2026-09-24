## What and why

<!-- What changes, and the reason. Link an issue if there is one. -->

## Definition of done

- [ ] `npm run verify:full` passes locally (format, lint, typecheck, docs check, unit tests, build, bundle budgets, e2e).
- [ ] Behavior changes are covered by a test that fails without the change (property, snapshot, component or e2e test, whichever is closest).
- [ ] Snapshot updates (`npx vitest run -u`) are intentional, and this description says why.
- [ ] Docs match the code: `README.md`, `CLAUDE.md`, `docs/architecture.md` (`npm run check:docs` catches broken references, but not wrong explanations).
- [ ] A choice a reviewer might question is recorded in `docs/decisions.md`.
- [ ] No new dependency, or its reason is given here.
