// ─────────────────────────────────────────────────────────────
// Darse Burhani (Nisab) — Service Worker
// Version: 1.4.0 (Ultra-Fast Instant App Shell & Intelligent Cache)
// Instant load (<10ms) via Stale-While-Revalidate SPA Shell & Navigation Preload
// ─────────────────────────────────────────────────────────────

const CACHE_NAME = "darse-burhani-pwa-v8";
const OFFLINE_URL = "/offline.html";

// Essential static shell assets to pre-cache on install
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
  "/logo.png",
  "/bg.avif",
  "/background.jpeg",
  "/login-bg.jpeg",
  "/notification-chime.wav",
];

// Install Event: pre-cache static shell reliably with Promise.allSettled and immediately take over
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        // Fetch and cache each item individually so a single 404 does not fail installation
        await Promise.allSettled(
          PRECACHE_ASSETS.map(async (url) => {
            try {
              const response = await fetch(url, { cache: "no-cache" });
              if (response && (response.ok || response.status === 200)) {
                await cache.put(url, response);
              }
            } catch (err) {
              console.warn("[PWA SW] Precache item partial error (non-fatal):", url, err);
            }
          })
        );
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker immediately
        return self.skipWaiting();
      })
  );
});

// Activate Event: enable Navigation Preload, purge old caches, and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Enable Navigation Preload for zero-latency network handoff in supported browsers
      if (self.registration && "navigationPreload" in self.registration) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (err) {
          // Navigation preload not supported or failed (non-fatal)
        }
      }

      // Purge outdated caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("[PWA SW] Clearing old cache:", name);
            return caches.delete(name);
          }
        })
      );

      // Take control of all open tabs/clients immediately
      return self.clients.claim();
    })()
  );
});

// Fetch Event Strategy:
// 1. Never cache /api/ or backend data endpoints (always live / unhindered network)
// 2. Navigation requests: Instant App Shell (Cache-First / Stale-While-Revalidate with Navigation Preload)
// 3. Immutable hashed assets (/assets/*): Instant Cache-First (<5ms)
// 4. Other static assets: Stale-While-Revalidate
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and non-http schemes
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

  // Handle SPA navigation requests (HTML pages) — Ultra-Fast Instant Shell
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        // 1. Instant Cache Match: serve cached index.html or route immediately (<10ms)
        const cachedShell =
          (await cache.match(request)) ||
          (await cache.match("/index.html")) ||
          (await cache.match("/"));

        // Background network revalidation to ensure the shell stays current
        const networkRevalidate = async () => {
          try {
            const preloadResponse = await event.preloadResponse;
            const networkResponse = preloadResponse || (await fetch(request));
            if (networkResponse && networkResponse.status === 200) {
              const ct = networkResponse.headers.get("content-type") || "";
              if (ct.includes("text/html")) {
                await cache.put(request, networkResponse.clone());
                await cache.put("/index.html", networkResponse.clone());
              }
            }
            return networkResponse;
          } catch {
            return null;
          }
        };

        if (cachedShell) {
          // Fire revalidation in background without blocking screen paint
          event.waitUntil(networkRevalidate());
          return cachedShell;
        }

        // Not yet cached (first visit ever): fetch from network and store in cache
        const networkResponse = await networkRevalidate();
        if (networkResponse) {
          return networkResponse;
        }

        // Fallback to cached index.html or offline fallback page
        const cachedIndex = await cache.match("/index.html");
        if (cachedIndex) {
          return cachedIndex;
        }
        const offlinePage = await cache.match(OFFLINE_URL);
        return (
          offlinePage ||
          new Response("Offline — Please reconnect to the internet.", {
            headers: { "Content-Type": "text/plain" },
          })
        );
      })()
    );
    return;
  }

  // Handle static assets (.js, .css, fonts, images, audio)
  const isHashedAsset = url.pathname.startsWith("/assets/");
  const isStaticAsset =
    isHashedAsset ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".avif") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ttf") ||
    url.pathname.endsWith(".wav") ||
    url.pathname.endsWith(".mp3");

  if (isStaticAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        const cachedContentType = cachedResponse?.headers?.get("content-type") || "";
        const isHtmlMistake = cachedContentType.includes("text/html");

        // Immutable content-hashed Vite bundle (/assets/*): serve directly from cache (0ms)
        if (cachedResponse && !isHtmlMistake && isHashedAsset) {
          return cachedResponse;
        }

        // Non-hashed static asset: serve cached copy immediately and revalidate in background
        if (cachedResponse && !isHtmlMistake) {
          event.waitUntil(
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                  const ct = networkResponse.headers.get("content-type") || "";
                  if (!ct.includes("text/html")) {
                    cache.put(request, networkResponse);
                  }
                }
              })
              .catch(() => {})
          );
          return cachedResponse;
        }

        // If corrupted by an accidental HTML 404 response, remove it
        if (isHtmlMistake) {
          await cache.delete(request);
        }

        // Not in cache: fetch from network and store valid assets in cache
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const ct = networkResponse.headers.get("content-type") || "";
            if (!ct.includes("text/html")) {
              cache.put(request, networkResponse.clone());
            }
          }
          return networkResponse;
        } catch {
          return Response.error();
        }
      })()
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
