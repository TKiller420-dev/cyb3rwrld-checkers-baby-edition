import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  base: './',
  clearScreen: false,
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts'
      },
      preload: {
        input: 'electron/preload.ts'
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1200
  }
});
