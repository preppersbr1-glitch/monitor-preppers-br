// Alertas push do PREPPERS BR (service worker).
// Só recebe e mostra notificações: não guarda páginas nem intercepta a navegação do site.
// A mensagem chega cifrada do Worker (pagamentos/worker.js) com { titulo, texto, link, tag }.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { texto: e.data ? e.data.text() : '' }; }
  var op = {
    body: d.texto || '',
    icon: '/icone-192.png',
    badge: '/alerta-badge.png',
    data: { link: d.link || '/' },
    vibrate: [200, 100, 200, 100, 300],
    lang: 'pt-BR'
  };
  if (d.tag) { op.tag = d.tag; op.renotify = true; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'PREPPERS BR', op));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var destino = new URL((e.notification.data && e.notification.data.link) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (janelas) {
    for (var i = 0; i < janelas.length; i++) if (janelas[i].url === destino && 'focus' in janelas[i]) return janelas[i].focus();
    return self.clients.openWindow(destino);
  }));
});
