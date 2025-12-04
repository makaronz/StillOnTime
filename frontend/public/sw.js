// Service Worker for StillOnTime Film Schedule Automation System
// Provides offline support, caching, and performance optimization

const CACHE_NAME = 'stillontime-v1.0.0';
const STATIC_CACHE = 'stillontime-static-v1.0.0';
const API_CACHE = 'stillontime-api-v1.0.0';
const DYNAMIC_CACHE = 'stillontime-dynamic-v1.0.0';

// Cache strategy configuration
const CACHE_STRATEGIES = {
  // Static assets - Cache First
  static: {
    cacheName: STATIC_CACHE,
    strategy: 'cacheFirst',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxEntries: 100
  },
  // API responses - Network First with cache fallback
  api: {
    cacheName: API_CACHE,
    strategy: 'networkFirst',
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxEntries: 50
  },
  // Dynamic content - Stale While Revalidate
  dynamic: {
    cacheName: DYNAMIC_CACHE,
    strategy: 'staleWhileRevalidate',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    maxEntries: 200
  }
};

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Critical CSS and JS
  '/assets/index-',
  '/assets/main-',
  // Images and icons
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Fonts
  '/fonts/inter-v12-latin-regular.woff2',
  '/fonts/inter-v12-latin-600.woff2'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/user/profile',
  '/api/dashboard/stats',
  '/api/calendar/events',
  '/api/notifications',
  '/api/config'
];

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      navigationStart: performance.now(),
      loadComplete: null,
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: 0,
      offlineApiCalls: 0
    };
  }

  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }

  recordApiCall(isOffline = false) {
    this.metrics.apiCalls++;
    if (isOffline) {
      this.metrics.offlineApiCalls++;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      offlineRate: this.metrics.offlineApiCalls / this.metrics.apiCalls || 0
    };
  }
}

const performanceMonitor = new PerformanceMonitor();

// Cache utilities
class CacheManager {
  static async openCache(cacheName) {
    return await caches.open(cacheName);
  }

  static async addToCache(cacheName, request, response) {
    const cache = await this.openCache(cacheName);
    await cache.put(request, response.clone());
  }

  static async getFromCache(cacheName, request) {
    const cache = await this.openCache(cacheName);
    const response = await cache.match(request);
    return response;
  }

  static async cleanCache(cacheName, maxAge, maxEntries) {
    const cache = await this.openCache(cacheName);
    const requests = await cache.keys();
    const now = Date.now();

    // Remove expired entries
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader && (now - new Date(dateHeader).getTime()) > maxAge) {
          await cache.delete(request);
        }
      }
    }

    // Remove excess entries (LRU)
    const updatedRequests = await cache.keys();
    if (updatedRequests.length > maxEntries) {
      const toDelete = updatedRequests.slice(maxEntries);
      await Promise.all(toDelete.map(request => cache.delete(request)));
    }
  }
}

// Network strategies
async function cacheFirst(request, cacheConfig) {
  try {
    const cachedResponse = await CacheManager.getFromCache(cacheConfig.cacheName, request);
    if (cachedResponse) {
      performanceMonitor.recordCacheHit();
      return cachedResponse;
    }

    performanceMonitor.recordCacheMiss();
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await CacheManager.addToCache(cacheConfig.cacheName, request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await CacheManager.getFromCache(cacheConfig.cacheName, request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function networkFirst(request, cacheConfig) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await CacheManager.addToCache(cacheConfig.cacheName, request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    performanceMonitor.recordApiCall(true);
    const cachedResponse = await CacheManager.getFromCache(cacheConfig.cacheName, request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheConfig) {
  const cachedResponse = await CacheManager.getFromCache(cacheConfig.cacheName, request);
  
  const networkPromise = fetch(request).then(async networkResponse => {
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await CacheManager.addToCache(cacheConfig.cacheName, request, responseClone);
    }
    return networkResponse;
  }).catch(() => {
    // Network failed, return cached response if available
    return cachedResponse;
  });

  if (cachedResponse) {
    performanceMonitor.recordCacheHit();
    // Revalidate in background
    networkPromise.then(networkResponse => {
      if (networkResponse && networkResponse.ok) {
        // Cache updated in background
      }
    });
    return cachedResponse;
  }

  performanceMonitor.recordCacheMiss();
  return networkPromise;
}

// Request routing
async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return fetch(request);
  }

  // Determine cache strategy
  let cacheConfig;
  
  if (url.pathname.startsWith('/api/')) {
    // API requests
    if (API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint))) {
      cacheConfig = CACHE_STRATEGIES.api;
      performanceMonitor.recordApiCall();
    } else {
      return fetch(request); // Don't cache non-specified API endpoints
    }
  } else if (STATIC_ASSETS.some(asset => url.pathname.includes(asset)) || 
             url.pathname.match(/\.(css|js|woff2?|png|jpg|jpeg|gif|svg|ico)$/)) {
    // Static assets
    cacheConfig = CACHE_STRATEGIES.static;
  } else {
    // Dynamic content
    cacheConfig = CACHE_STRATEGIES.dynamic;
  }

  // Apply strategy
  switch (cacheConfig.strategy) {
    case 'cacheFirst':
      return cacheFirst(request, cacheConfig);
    case 'networkFirst':
      return networkFirst(request, cacheConfig);
    case 'staleWhileRevalidate':
      return staleWhileRevalidate(request, cacheConfig);
    default:
      return fetch(request);
  }
}

// Service Worker events
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => 
              cacheName !== STATIC_CACHE && 
              cacheName !== API_CACHE && 
              cacheName !== DYNAMIC_CACHE
            )
            .map(cacheName => caches.delete(cacheName))
        );
      }),
      // Clean current caches
      CacheManager.cleanCache(STATIC_CACHE, CACHE_STRATEGIES.static.maxAge, CACHE_STRATEGIES.static.maxEntries),
      CacheManager.cleanCache(API_CACHE, CACHE_STRATEGIES.api.maxAge, CACHE_STRATEGIES.api.maxEntries),
      CacheManager.cleanCache(DYNAMIC_CACHE, CACHE_STRATEGIES.dynamic.maxAge, CACHE_STRATEGIES.dynamic.maxEntries)
    ]).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Handle queued offline actions
  const offlineActions = await getOfflineActions();
  
  for (const action of offlineActions) {
    try {
      await fetch(action.url, action.options);
      await removeOfflineAction(action.id);
    } catch (error) {
      console.error('[SW] Failed to sync action:', error);
    }
  }
}

// Push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from StillOnTime',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Explore',
        icon: '/images/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/images/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('StillOnTime', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handling for communication with main app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'GET_PERFORMANCE_METRICS') {
    event.ports[0].postMessage(performanceMonitor.getMetrics());
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Utility functions for offline storage
async function getOfflineActions() {
  // Implementation would depend on your storage strategy
  // This is a placeholder for demonstration
  return [];
}

async function removeOfflineAction(actionId) {
  // Implementation would depend on your storage strategy
  return true;
}

// Performance optimization: periodic cache cleanup
setInterval(async () => {
  try {
    await CacheManager.cleanCache(STATIC_CACHE, CACHE_STRATEGIES.static.maxAge, CACHE_STRATEGIES.static.maxEntries);
    await CacheManager.cleanCache(API_CACHE, CACHE_STRATEGIES.api.maxAge, CACHE_STRATEGIES.api.maxEntries);
    await CacheManager.cleanCache(DYNAMIC_CACHE, CACHE_STRATEGIES.dynamic.maxAge, CACHE_STRATEGIES.dynamic.maxEntries);
  } catch (error) {
    console.error('[SW] Cache cleanup error:', error);
  }
}, 60 * 60 * 1000); // Every hour

console.log('[SW] Service worker loaded successfully');
