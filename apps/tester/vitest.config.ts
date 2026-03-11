import { fileURLToPath } from 'node:url';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mininic-nt/lexical-freemarker': path.resolve(rootDir, 'src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
