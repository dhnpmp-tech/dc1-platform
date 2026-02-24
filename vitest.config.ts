import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'backend/src/__tests__/**/*.test.ts',
      'backend/tests/**/*.test.ts',
    ],
    globals: false,
    environment: 'node',
    testTimeout: 30000,
    mockReset: false,
  },
  resolve: {
    alias: {
      '@': '.',
    },
  },
});
