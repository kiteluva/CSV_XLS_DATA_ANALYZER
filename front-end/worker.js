// worker.js - Service Worker for PWA caching

const CACHE_NAME = 'csv-analyzer-cache-v2'; // Increment cache version due to file changes
const urlsToCache = [
    '/',
    'index.html', // Renamed from home.html to index.html as the primary entry
    'reporting.html', // Add the new reporting.html
    // 'branches.html', // Removed as it's consolidated into reporting.html
    // 'employees.html', // Removed as it's consolidated into reporting.html
    'time-series.html',
    'complex_stats.html',
    'main.js',
    'charting.js',
    'ui-components.js',
    'data-handlers.js',
    'home.js',
    // 'branches.js', // Removed
    // 'employees.js', // Removed
    'time-series.js',
    'complex_stats.js',
    'reporting.js', // Add the new reporting.js
    'style.css',
    'manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js' // Add XLSX library
    // Add any other static assets or external CDN links your app relies on
];

// Install event: Caches all static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Opened cache');
                // Ensure all URLs are fetched and cached. Use Promise.allSettled for robustness.
                return Promise.allSettled(
                    urlsToCache.map(url => {
                        return fetch(url).then(response => {
                            if (!response.ok) {
                                console.warn(`[Service Worker] Failed to fetch ${url}: ${response.status} ${response.statusText}`);
                                return Promise.reject(new Error(`Failed to fetch ${url}`));
                            }
                            return cache.put(url, response);
                        }).catch(error => {
                            console.warn(`[Service Worker] Could not cache ${url}:`, error);
                            // Don't reject the whole Promise.allSettled if one fails
                        });
                    })
                ).then(results => {
                    results.forEach(result => {
                        if (result.status === 'rejected') {
                            console.error(`[Service Worker] Failed to cache: ${result.reason}`);
                        }
                    });
                    console.log('[Service Worker] All cache operations attempted.');
                });
            })
            .catch(error => {
                console.error('[Service Worker] Cache open failed:', error);
                return Promise.reject(error); // Reject the install event if cache open fails
            })
    );
});


// Activate event: Cleans up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((cacheName) => {
                    return cacheName.startsWith('csv-analyzer-cache-') && cacheName !== CACHE_NAME;
                }).map((cacheName) => {
                    console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                    return caches.delete(cacheName);
                })
            );
        })
    );
});

// Fetch event: Serves cached content first, then falls back to network
self.addEventListener('fetch', (event) => {
    // Only handle http(s) requests, not chrome-extension:// or other schemes
    if (!event.request.url.startsWith('http') && !event.request.url.startsWith('https')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // No cache hit - fetch from network
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        // IMPORTANT: Clone the response. A response is a stream
                        // and can only be consumed once. We must clone it so that
                        // both the browser and the cache can consume it.
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // Only cache GET requests, and don't cache chrome-extension resources
                                if (event.request.method === 'GET' && !event.request.url.startsWith('chrome-extension')) {
                                    cache.put(event.request, responseToCache);
                                }
                            });

                        return networkResponse;
                    })
                    .catch(error => {
                        console.error('[Service Worker] Fetch failed:', event.request.url, error);
                        // You could return an offline page here
                        // For example: return caches.match('offline.html');
                        // For now, it will just fail to load if offline and not in cache.
                    });
            })
    );
});
