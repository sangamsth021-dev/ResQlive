import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'electron-vite/plugin';

export default defineConfig({
  plugins: [react(), electron()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@resq/*': ['../../packages/*/src'],
    },
  },
});