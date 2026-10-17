// Serumpun's emergency alerts (Me › Emergency alerts registers this). It shows an alert the server pushed, even when the
// app is closed, and opens the app on it when tapped. Nothing is cached: pages always come from the network.

// Look after the open pages at once, so tapping an alert can move one of them to the map.
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  const message = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(message.title || 'Serumpun', {
      body: message.body,
      tag: message.tag, // one notification per emergency, however often it is sent
      renotify: true,
      requireInteraction: true, // an emergency stays on screen until the person deals with it
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [300, 100, 300, 100, 300],
      data: { url: message.url || '/home' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.url, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const [open] = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (open) {
        await open.focus();
        try {
          await open.navigate(url);
          return;
        } catch {
          // a page this worker does not look after yet: open the alert in a new one
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
