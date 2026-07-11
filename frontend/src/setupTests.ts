// jest-dom adds custom matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
// The /vitest entry registers the matchers on Vitest's expect and augments
// its Assertion types.
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// react-router v7 requires TextEncoder/TextDecoder (not available in jsdom)
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

// @testing-library/dom decides whether fake timers are active by probing the
// Jest global (jestFakeTimersAreEnabled). Vitest doesn't define it, so waitFor
// would poll with never-firing fake timers and hang. Expose only the minimal
// surface RTL needs to advance Vitest's fake timers.
Object.assign(globalThis, {
  jest: { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) },
});

// jsdom doesn't implement window.matchMedia — provide a minimal mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});
