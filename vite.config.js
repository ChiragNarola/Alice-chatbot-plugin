import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'alice-plugin.js'),
      name: 'AliceChatPlugin',
      fileName: (format)=>`alice-plugin.${format}.js`,
      formats: ['iife']
    },
    rollupOptions:{
      output:{
        assetFileNames:`chatbot.[ext]`,
      }
    },
    minify: 'terser',
  }
});
