import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 10000,
    pool: 'threads',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/index.ts',
        'src/entrypoints/**/main.tsx',
        'src/entrypoints/sidepanel/App.tsx',
        'src/entrypoints/background.ts',
        'src/entrypoints/content.ts',
        'src/types/**',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 85,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
