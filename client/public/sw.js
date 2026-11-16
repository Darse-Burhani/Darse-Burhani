// ─────────────────────────────────────────────────────────────
// Darse Burhani (Nisab) — Service Worker
// Version: 1.3.0
// Caches core app shell & static assets for instant load and offline resilience
// ─────────────────────────────────────────────────────────────

const CACHE_NAME = "darse-burhani-pwa-v7";
const OFFLINE_URL = "/offline.html";

// Essential static shell assets to pre-cache on install (Gold Sacred Geometry Icon Suite)
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/site.webmanifest",
  "/manifest.json",
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-32x32.png",
  "/favicon-16x16.png",
  "/apple-touch-icon-180x180.png",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/maskable-icon-512x512.png",
  "/Al-Kanz.ttf",
  "/notification-chime.wav",
];

// Install Event: pre-cache the static shell and immediately take over
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn("[PWA SW] Precache partial error (non-fatal):", err);
        });
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
  );
});

// Activate Event: clean up outdated previous caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log("[PWA SW] Clearing old cache:", name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => {
        // Become available to all open tabs immediately
        return self.clients.claim();
      })
  );
});

// Fetch Event Strategy:
// 1. Never cache /api/ or backend data endpoints (always network-first / live)
// 2. Navigation requests: Network-First with Cache fallback, then offline.html
// 3. Static assets (.js, .css, .png, .svg, .woff2, .ttf): Stale-While-Revalidate / Cache-First
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and internal schemes
  if (request.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // Same-origin only. Third-party assets (fonts.gstatic.com, fonts.googleapis.com)
  // must be fetched by the browser itself: a service-worker fetch() counts as a
  // `connect-src` connection and the CSP ("connect-src 'self' ws: wss:") blocks it.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Bypass API requests, uploads, websocket HMR, or backend proxies
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname.startsWith("/socket.io/")
  ) {
    return;
  }

  // Handle SPA navigation requests (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If valid response, clone into cache for offline recovery
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Network failed: try cache first
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to cached index.html or offline fallback page
          const cachedIndex = await caches.match("/index.html");
          if (cachedIndex) {
            return cachedIndex;
          }
          const offlinePage = await caches.match(OFFLINE_URL);
          return offlinePage || new Response("Offline — Please reconnect to the internet.", {
            headers: { "Content-Type": "text/plain" },
          });
        })
    );
    return;
  }

  // Handle static assets (.js, .css, fonts, images)
  const isStaticAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ttf");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // If cached response exists, verify it is not an accidental HTML error page
        const cachedContentType = cachedResponse?.headers?.get("content-type") || "";
        const isHtmlMistake = cachedContentType.includes("text/html");

        if (cachedResponse && !isHtmlMistake) {
          // Fetch updated version in background (Stale-While-Revalidate)
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const ct = networkResponse.headers.get("content-type") || "";
                if (!ct.includes("text/html")) {
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, networkResponse);
                  });
                }
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // If it was cached as HTML by mistake, remove it from cache immediately
        if (isHtmlMistake) {
          caches.open(CACHE_NAME).then((cache) => cache.delete(request));
        }

        // Not in cache (or removed): fetch from network and store only valid non-HTML assets
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const ct = networkResponse.headers.get("content-type") || "";
              if (!ct.includes("text/html")) {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, clone);
                });
              }
            }
            return networkResponse;
          })
          .catch(() => {
            // No cached copy and the network failed: surface a real network error.
            return Response.error();
          });
      })
    );
  }
});

// Message Event: Skip waiting, update PWA badge, or dispatch system notification
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING" || event.data === "skipWaiting") {
    console.log("[PWA SW] Received SKIP_WAITING signal, claiming clients.");
    self.skipWaiting();
  }
  if (event.data.type === "UPDATE_BADGE") {
    const count = Number(event.data.badgeCount || 0);
    if ("setAppBadge" in self.navigator) {
      if (count > 0) {
        self.navigator.setAppBadge(count).catch(() => {});
      } else {
        self.navigator.clearAppBadge().catch(() => {});
      }
    }
  }
  if (event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data.payload || {};
    if (title && self.registration && self.registration.showNotification) {
      event.waitUntil(
        self.registration.showNotification(title, {
          icon: "/pwa-192x192.png",
          badge: "/favicon-32x32.png",
          vibrate: [300, 100, 300, 100, 400],
          renotify: true,
          silent: false,
          sound: "/notification-chime.wav",
          ...options,
        })
      );
    }
  }
});

// Push Event: Triggers native OS / System Notifications outside the browser/PWA
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "Darse Burhani", body: event.data.text() };
    }
  }

  const title = data.title || "Darse Burhani Notification";
  const rawBody = data.body || "New update available.";
  let cleanBody = rawBody;
  if (typeof rawBody === "string" && rawBody.trim().startsWith("{") && rawBody.trim().endsWith("}")) {
    try {
      const parsed = JSON.parse(rawBody);
      cleanBody = parsed.message || parsed.subject || rawBody;
    } catch {}
  }

  const options = {
    body: cleanBody,
    icon: data.icon || "/pwa-192x192.png",
    badge: data.badge || "/favicon-32x32.png",
    tag: data.tag || `darse-push-${Date.now()}`,
    vibrate: [300, 100, 300, 100, 400],
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    silent: false,
    sound: "/notification-chime.wav",
    data: {
      url: data.url || data.link || "/",
      link: data.url || data.link || "/",
      timestamp: Date.now(),
    },
    actions: [
      { action: "open", title: "View Details" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Event: Routes user into the exact app screen when clicked from Notification Center / Lock Screen
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const targetPath =
    (event.notification.data && (event.notification.data.url || event.notification.data.link)) || "/";
  const fullTargetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If an existing app window/tab is open, focus and navigate it
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          if ("navigate" in client && client.url !== fullTargetUrl) {
            client.navigate(fullTargetUrl);
          }
          return client.focus();
        }
      }
      // If no window is currently open, open a new window to the destination
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullTargetUrl);
      }
    })
  );
});

// Notification Close Event
self.addEventListener("notificationclose", (_event) => {
  // Graceful dismiss
});
