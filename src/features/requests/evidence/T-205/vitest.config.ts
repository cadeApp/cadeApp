import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/features/requests/evidence/T-205/browser-audit.tsx'],
    testTimeout: 60000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
      'server-only': path.resolve(process.cwd(), 'node_modules/server-only/empty.js'),
    },
  },
});
