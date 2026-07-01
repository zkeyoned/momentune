import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@algorithm': resolve(__dirname, './src/algorithm'),
      '@config': resolve(__dirname, './src/algorithm/config'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/algorithm/**/*.ts'],
      exclude: ['src/algorithm/**/*.test.ts', 'src/algorithm/__tests__/**', 'src/algorithm/demo.ts', 'src/algorithm/index.ts'],
    },
  },
});
