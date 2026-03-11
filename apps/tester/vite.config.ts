import { fileURLToPath } from 'node:url';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const base = process.env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}/` : '/';

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@mininic-nt/lexical-freemarker': path.resolve(rootDir, 'src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
