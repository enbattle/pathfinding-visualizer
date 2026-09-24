/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Content Security Policy for the production build. GitHub Pages can't set
// response headers, so it ships as a <meta> tag (which covers everything
// here except frame-ancestors). The app loads nothing from other origins
// and has no inline scripts, so scripts are 'self' only. Share links live
// in the URL fragment, which never reaches a server; the CSP is defense
// in depth for that user-controlled input. The e2e suite fails on any CSP
// violation, so loosening a rule needs a real reason.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Radix's dialog/select scroll lock injects <style> elements with computed
  // values (so no fixed hash works, and a static host can't mint nonces).
  // Inline CSS can't execute code, scripts stay 'self'-only, and React
  // escapes all rendered text, so there's no markup-injection path for CSS
  // tricks to exploit. Covered by the e2e test "dialogs and menus work
  // under the Content Security Policy".
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

// Only for `vite build`: the dev server relies on an inline script (React
// Fast Refresh) that this policy would rightly block.
function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: html => ({
      html,
      tags: [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: CONTENT_SECURITY_POLICY,
          },
          injectTo: 'head-prepend',
        },
      ],
    }),
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  base: '/pathfinding-visualizer/',
  build: {
    // The lazily loaded 3D view (three.js) is one ~575 kB chunk (~145 kB
    // gzipped) that only downloads when someone opens the 3D view. The
    // limit sits just above it, so the warning still catches the main
    // bundle (~415 kB) growing past that. scripts/check-bundle.mjs
    // enforces the real (gzipped) budgets.
    chunkSizeWarningLimit: 600,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    // Unit/component tests only; e2e/ is Playwright's (npm run test:e2e).
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
