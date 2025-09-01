// frontend/vite.config.js
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // This loads the .env files
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // This MUST match your GitHub repository name
    base: '/editor/',
    build: {
      outDir: 'dist',
    },
    // Your local development server settings
    server: {
      host: '0.0.0.0',
      port: 5173,
      hmr: {
        clientPort: 80,
      },
      watch: {
        usePolling: true,
      },
    },
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'wWiting Editor',
          short_name: 'Editor',
          description: 'A simple no distrubance writing editor with AI assistance.',
          theme_color: '#1a1a1a',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '.',
          // Updated to use your new icon
          icons: [
            {
              src: 'feather-pen.png', // Main icon
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'feather-pen.png', // Larger version for splash screens etc.
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
        // --- THIS IS THE NEW, CRITICAL PART ---
        workbox: {
          // This pre-caches all your app's assets (JS, CSS, etc.) during installation.
          globPatterns: ['**/*.{js,css,html,svg,png}'],

          // This defines the strategy for runtime requests, like page navigations.
          runtimeCaching: [
            {
              // This rule is for all navigation requests (i.e., when you refresh the page).
              urlPattern: ({ request }) => request.mode === 'navigate',
              // Use the "Stale-While-Revalidate" strategy.
              handler: 'StaleWhileRevalidate',
              options: {
                // Name for the cache where these pages will be stored.
                cacheName: 'pages-cache',
              },
            },
          ],
        },
      })
    ],
  };
});