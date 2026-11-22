// Service worker: guarda la app en el teléfono para que abra sin internet.

const CACHE = "mi-radio-v6";   // al subir de versión se borran los audios viejos guardados (la voz anterior)
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
// - los audios de Mimi (carpeta mimi): salen de la copia guardada, que es rápido y funciona sin
//   internet, y se actualizan en segundo plano
// - los demás archivos de la app: primero internet (así ves tus cambios) y, si no hay, la copia guardada
// - los externos (la librería y la tipografía): la copia guardada primero; si no la hay,
//   se descarga y se guarda para la próxima vez
self.addEventListener("fetch", evento => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);
  const esDeLaApp = url.origin === self.location.origin;

  if (esDeLaApp && url.pathname.includes("/mimi/")) {
    evento.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const guardada = await cache.match(peticion);
      const actualizar = fetch(peticion)
        .then(respuesta => {
          if (respuesta.status === 200) cache.put(peticion, respuesta.clone());
          return respuesta;
        })
        .catch(() => null);
      if (guardada) {
        evento.waitUntil(actualizar);
        return guardada;
      }
      return (await actualizar) || Response.error();
    })());
    return;
  }

  if (esDeLaApp) {
    evento.respondWith(
      fetch(peticion)
        .then(respuesta => {
          if (respuesta.status === 200) {
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
