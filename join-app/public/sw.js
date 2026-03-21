// ─── theKickBack Service Worker ──────────────────────────────────
// Provides: offline support, runtime caching, background sync,
// push notifications, and navigation preload.
// ─────────────────────────────────────────────────────────────────

const CACHE_VERSION = 3;
const STATIC_CACHE = `kickback-static-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `kickback-runtime-v${CACHE_VERSION}`;
const API_CACHE = `kickback-api-v${CACHE_VERSION}`;

// Assets to precache on install
const PRECACHE_URLS = [
  "/",
  "/logo.png",
  "/manifest.json",
  "/offline",
];

// API routes to cache (stale-while-revalidate)
const CACHEABLE_API_PATTERNS = [
  "/api/venue-page",
  "/api/discover",
  "/api/offerings",
  "/api/points",
  "/api/live-stats",
];

// Never cache these
const NEVER_CACHE = [
  "/api/auth/",
  "/api/chat",
  "/api/wallet",
  "/api/book",
  "/api/checkin",
  "/api/orders",
  "/api/passkey",
];

// ─── Install ────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  const currentCaches = [STATIC_CACHE, RUNTIME_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !currentCaches.includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch strategies ───────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET requests (let POST/PATCH/DELETE pass through for background sync)
  if (event.request.method !== "GET") return;

  // Skip never-cache routes
  if (NEVER_CACHE.some((p) => url.pathname.startsWith(p))) return;

  // API routes: stale-while-revalidate
  if (url.pathname.startsWith("/api/")) {
    if (CACHEABLE_API_PATTERNS.some((p) => url.pathname.startsWith(p))) {
      event.respondWith(staleWhileRevalidate(event.request, API_CACHE, 300));
    }
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstWithOffline(event.request));
    return;
  }

  // Static assets (JS, CSS, images, fonts): cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(event.request, RUNTIME_CACHE));
});

// ─── Cache-first (static assets) ────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 408, statusText: "Offline" });
  }
}

// ─── Network-first (pages) ──────────────────────────────────────

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("Offline", { status: 503 });
  }
}

// ─── Network-first with offline page fallback ───────────────────

async function networkFirstWithOffline(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try to serve cached version of this page
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fall back to offline page
    const offlinePage = await caches.match("/offline");
    if (offlinePage) return offlinePage;

    return new Response(
      '<html><body style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui"><div style="text-align:center"><h1>You\'re offline</h1><p style="color:#999">Check your connection and try again</p></div></body></html>',
      { headers: { "Content-Type": "text/html" }, status: 503 }
    );
  }
}

// ─── Stale-while-revalidate (API data) ──────────────────────────

async function staleWhileRevalidate(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      // Store with timestamp header for TTL checking
      const headers = new Headers(response.headers);
      headers.set("sw-cached-at", Date.now().toString());
      const timedResponse = new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, timedResponse);
    }
    return response;
  }).catch(() => cached);

  // If cached, check TTL
  if (cached) {
    const cachedAt = parseInt(cached.headers.get("sw-cached-at") || "0");
    const age = (Date.now() - cachedAt) / 1000;
    if (age < maxAgeSeconds) {
      // Still fresh — return cached, revalidate in background
      fetchPromise; // fire and forget
      return cached;
    }
  }

  // No cache or stale — wait for network
  return fetchPromise;
}

// ─── Background Sync ────────────────────────────────────────────
// Queue failed POST requests (check-ins, orders) for retry

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-checkin") {
    event.waitUntil(replayRequests("checkin-queue"));
  }
  if (event.tag === "sync-orders") {
    event.waitUntil(replayRequests("order-queue"));
  }
});

async function replayRequests(storeName) {
  // Read queued requests from IndexedDB
  try {
    const db = await openSyncDB();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const requests = await idbGetAll(store);

    for (const item of requests) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });
        if (response.ok) {
          store.delete(item.id);
        }
      } catch {
        // Will retry on next sync
        break;
      }
    }
  } catch {
    // IndexedDB not available
  }
}

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("kickback-sync", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("checkin-queue")) {
        db.createObjectStore("checkin-queue", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("order-queue")) {
        db.createObjectStore("order-queue", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Push Notifications ─────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = { title: "theKickBack", body: "You have a notification", url: "/" };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/logo.png",
    badge: "/logo.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
    actions: data.actions || [],
    tag: data.tag || "default",
    renotify: !!data.tag,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── Periodic Background Sync (venue freshness) ─────────────────
// Refresh cached venue data periodically when the browser allows

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "refresh-venues") {
    event.waitUntil(refreshCachedVenues());
  }
});

async function refreshCachedVenues() {
  const cache = await caches.open(API_CACHE);
  const keys = await cache.keys();

  for (const request of keys) {
    if (request.url.includes("/api/venue-page") || request.url.includes("/api/discover")) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const headers = new Headers(response.headers);
          headers.set("sw-cached-at", Date.now().toString());
          const timedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
          await cache.put(request, timedResponse);
        }
      } catch {
        // Offline or failed — keep stale cache
      }
    }
  }
}

// ─── Message handling (from main thread) ─────────────────────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  // Queue a request for background sync
  if (event.data?.type === "QUEUE_REQUEST") {
    const { storeName, url, method, headers, body } = event.data;
    queueRequest(storeName, { url, method, headers, body });
  }

  // Cache a specific URL
  if (event.data?.type === "CACHE_URL") {
    caches.open(RUNTIME_CACHE).then((cache) => cache.add(event.data.url));
  }
});

async function queueRequest(storeName, data) {
  try {
    const db = await openSyncDB();
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).add(data);
  } catch {
    // Best effort
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)$/i.test(pathname)
    || pathname.startsWith("/_next/static/");
}
