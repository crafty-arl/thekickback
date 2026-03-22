// ─── theKickBack Service Worker ──────────────────────────────────
// Network-first for everything. Cache only as offline fallback.
// Push notifications and background sync still work.
// ─────────────────────────────────────────────────────────────────

const BUILD_HASH = "__BUILD_HASH__";
const CACHE = `kickback-${BUILD_HASH}`;

// ─── Install: skip waiting immediately ──────────────────────────

self.addEventListener("install", () => {
  self.skipWaiting();
});

// ─── Activate: claim clients + purge old caches ─────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: network-first always, cache as offline fallback ─────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;

  // Never intercept API routes — let them pass through directly
  if (url.pathname.startsWith("/api/")) return;

  // Everything else: network-first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for offline fallback (images, pages)
        if (response.ok && (event.request.mode === "navigate" || isAsset(url.pathname))) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        // Offline — try cache
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // Offline fallback for navigation
        if (event.request.mode === "navigate") {
          return new Response(
            '<html><body style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui"><div style="text-align:center"><h1>You\'re offline</h1><p style="color:#999">Check your connection and try again</p></div></body></html>',
            { headers: { "Content-Type": "text/html" }, status: 503 }
          );
        }

        return new Response("", { status: 408 });
      })
  );
});

// ─── Push Notifications ─────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = { title: "theKickBack", body: "You have a notification", url: "/" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { if (event.data) data.body = event.data.text(); }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/logo.png",
      badge: "/logo.png",
      vibrate: [100, 50, 100],
      data: { url: data.url || "/" },
      tag: data.tag || "default",
      renotify: !!data.tag,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── Message handling ───────────────────────────────────────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// ─── Helpers ────────────────────────────────────────────────────

function isAsset(pathname) {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)$/i.test(pathname);
}
