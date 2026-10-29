// ─────────────────────────────────────────────────────────────
// Darse Burhani (Nisab) — Service Worker
// Version: 1.3.0
// Caches core app shell & static assets for instant load and offline resilience
// ─────────────────────────────────────────────────────────────

const CACHE_NAME = "darse-burhani-pwa-v3";
const OFFLINE_URL = "/offline.html";

// Essential static shell assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/site.webmanifest",
  "/manifest.json",
  "/favicon.svg",
  "/favicon-32x32.png",
  "/favicon-16x16.png",
  "/apple-touch-icon.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/logo.png",
  "/Al-Kanz.ttf",
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
        if (cachedResponse) {
          // Fetch updated version in background (Stale-While-Revalidate)
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse);
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Not in cache: fetch from network and store in cache
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // No cached copy and the network failed: surface a real network error.
            // (Fabricating a 408 only pollutes the console — the asset is simply
            // unavailable while offline.)
            return Response.error();
          });
      })
    );
  }
});

// Skip waiting on direct message trigger from app
self.addEventListener("message", (event) => {
  if (event.data && (event.data.type === "SKIP_WAITING" || event.data === "skipWaiting")) {
    console.log("[PWA SW] Received SKIP_WAITING signal, claiming clients.");
    self.skipWaiting();
  }
});
