import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 15000,
    teardownTimeout: 15000,
    pool: 'vmThreads',
  },
});

