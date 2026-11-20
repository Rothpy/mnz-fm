// Service worker: guarda la app en el teléfono para que abra sin internet.

const CACHE = "mi-radio-v4";
const ARCHIVOS = [
  "./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png",
  "./icono-play.png", "./icono-pausa.png", "./icono-adelante.png", "./icono-atras.png"
];
const LIBRERIA = "https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js";

// Al instalarse: guarda los archivos de la app y la librería
self.addEventListener("install", evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ARCHIVOS);
    try { await cache.add(LIBRERIA); } catch (error) {}
  })());
  self.skipWaiting();
});

// Al activarse: borra copias viejas de versiones anteriores
self.addEventListener("activate", evento => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Cada vez que la app pide un archivo:
// - los de la app: primero internet (así ves tus cambios) y, si no hay, la copia guardada
// - los externos (la librería y la tipografía): la copia guardada primero; si no la hay,
//   se descarga y se guarda para la próxima vez
self.addEventListener("fetch", evento => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;

  const esDeLaApp = new URL(peticion.url).origin === self.location.origin;

  if (esDeLaApp) {
    evento.respondWith(
      fetch(peticion)
        .then(respuesta => {
          if (respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(CACHE).then(cache => cache.put(peticion, copia));
          }
          return respuesta;
        })
        .catch(() => caches.match(peticion, { ignoreSearch: true }))
    );
  } else {
    evento.respondWith(
      caches.match(peticion).then(guardada => {
        if (guardada) return guardada;
        return fetch(peticion).then(respuesta => {
          if (respuesta.ok || respuesta.type === "opaque") {
            const copia = respuesta.clone();
            caches.open(CACHE).then(cache => cache.put(peticion, copia));
          }
          return respuesta;
        });
      })
    );
  }
});
