# Security

## Reporting a vulnerability

Please report security issues privately through GitHub: the repository's
**Security** tab, then **Report a vulnerability**. Please don't open a
public issue. You can expect a reply within a week.

## Scope

This is a static site with no backend, accounts or stored user data. The
parts worth scrutinizing:

- **Share links** (`src/visualizer/share.ts`): the URL fragment is
  untrusted input. Decoding must never throw, must bound its work before
  parsing, and must reject anything outside the documented limits. It is
  fuzz-tested in `src/visualizer/share.test.ts`.
- **Content Security Policy:** injected at build time in `vite.config.ts`.
  Scripts are `'self'` only; the reason inline styles are allowed is in
  `docs/decisions.md`. The e2e suite fails on any CSP violation.
- **Supply chain:** GitHub Actions are pinned to commit SHAs, CI runs
  `npm audit`, the deploy installs without a dependency cache, and
  Dependabot keeps dependencies and action pins current.
