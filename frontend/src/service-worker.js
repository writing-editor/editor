// A very basic service worker for PWA installability.
// It doesn't do any caching yet.

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  // The service worker is installed.
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  // The service worker is activated.
});

self.addEventListener('fetch', (event) => {
  // We are not intercepting fetch requests yet, so we do nothing.
  // This is where offline caching logic will go later.
  return;
});