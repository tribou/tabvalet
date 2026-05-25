import { defineConfig, defaultExclude } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
    exclude: [...defaultExclude, 'tests/e2e/**'],
  },
});
