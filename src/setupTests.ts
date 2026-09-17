// jest-dom adds custom matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
// The /vitest entrypoint (vs. the plain package root) is what augments
// vitest's own Assertion type with these matchers - without it the
// matchers work at runtime but tsc doesn't know they exist.
import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement ResizeObserver at all. Radix's Slider (used for
// Animation Speed) reads its thumb size via @radix-ui/react-use-size, which
// calls `new ResizeObserver(...)` unconditionally on mount - without this
// stub every test that renders <Configuration /> fails before any
// assertion runs, since ResizeObserver is undefined in jsdom.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
