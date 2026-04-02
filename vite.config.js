import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'alice-plugin.js'),
      name: 'AliceChatPlugin',
      fileName: 'alice-plugin',
      formats: ['iife']
    },
    minify: 'terser',
  }
});
