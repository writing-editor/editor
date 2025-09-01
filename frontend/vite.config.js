// frontend/vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  // For a user page repo (username.github.io), the base path IS the root.
  base: '/editor/',
  build: {
    outDir: 'dist',
  },
});