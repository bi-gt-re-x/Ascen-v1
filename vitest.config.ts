/**
 * The test runner, configured against the app's own build.
 *
 * A separate file rather than a `test` block inside vite.config.ts, so that
 * building the app does not load the runner and `vite build` stays what it was.
 * The build config is merged in whole, which is what keeps the `@` alias and
 * the React plugin identical to the ones the app ships with — a test importing
 * `@/utils/dates` must resolve the same module the bundle does, or it is
 * testing something else.
 *
 * `root` comes back out to the repo root. vite.config.ts points Vite at
 * `frontend/` because that is where index.html lives; tests have no index.html
 * and every path here reads better from the root the paths are written from.
 */
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      root: fileURLToPath(new URL('.', import.meta.url)),
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./frontend/src/test/setup.ts'],
      include: ['frontend/src/**/*.test.{ts,tsx}'],
      // Stylesheets are imported by components for their side effect and have
      // nothing to assert against. Left unprocessed, they cost nothing.
      css: false,
      // Every `vi.fn()` and `vi.spyOn` is undone between tests, so a stub left
      // behind by one file cannot decide the outcome of the next. `clearMocks`
      // is the other half and matters more than it looks: several tests here
      // assert *how many times* a service was called, and without it the count
      // is the whole file's running total rather than this test's.
      restoreMocks: true,
      clearMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
      coverage: {
        provider: 'v8',
        include: ['frontend/src/**/*.{ts,tsx}'],
        exclude: ['frontend/src/**/*.test.{ts,tsx}', 'frontend/src/test/**'],
      },
    },
  }),
);
