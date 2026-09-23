// Minimal service worker — findes kun for at gøre siden installerbar som en
// app (nogle browsere kræver en registreret service worker for at vise
// "Føj til hjemmeskærm"). Ingen offline-cache: alt hentes altid friskt fra
// netværket, så det ikke kommer i vejen for ?v=-cache-busting'en andre
// steder på siden.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
