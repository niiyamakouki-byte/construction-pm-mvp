/**
 * GenbaHub push handlers — imported into the workbox-generated service worker
 * via vite-plugin-pwa `workbox.importScripts`.
 *
 * Keep this plain JS with no imports: it runs inside the already-bundled SW.
 * Only push display + click-to-focus live here; caching stays in the workbox SW.
 */
/* global self, clients */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "GenbaHub";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    tag: payload.tag || undefined,
    data: { url: payload.url || "/", ...(payload.data || {}) },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing tab if one is open, otherwise open a new one.
        for (const client of windowClients) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client && targetUrl !== "/") {
              client.navigate(targetUrl).catch(() => {});
            }
            return undefined;
          }
        }
        return clients.openWindow(targetUrl);
      }),
  );
});
