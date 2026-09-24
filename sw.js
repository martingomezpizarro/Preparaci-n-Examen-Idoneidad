// Mapa normativo del idóneo — service worker
// Igual que Jarvis: "la red primero, el cache como respaldo". Siempre busca la
// versión más nueva; sin señal sirve la copia guardada. Además es el que muestra
// el aviso diario y, al tocarlo, abre la pestaña de Micro-learning.
const CACHE = "mapa-idoneo-2026-09-24c";
// El tráfico de la cuenta (Firebase) no pasa por el cache: Firestore mantiene una
// conexión viva y guardarla rompe la sincronización.
const SIN_CACHE = /(?:googleapis\.com|firebaseio\.com|firebaseapp\.com|identitytoolkit|securetoken)/;
const ESENCIALES = ["./", "./index.html", "./manifest.json", "./icono-192.png", "./icono-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ESENCIALES.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (SIN_CACHE.test(url.hostname)) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type !== "opaque") {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => {
        if (r) return r;
        if (req.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      }))
  );
});

// Tocar el aviso: si la app ya está abierta, la trae al frente en #micro;
// si no, la abre ahí.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || "./#micro";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if ("focus" in c) {
          if ("navigate" in c) c.navigate(destino).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(destino) : null;
    })
  );
});
