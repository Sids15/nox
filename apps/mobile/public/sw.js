// Nox service worker: shows server reminders (Web Push) and opens Nox when one is tapped.
// It does nothing else — no caching, no fetch handling.
self.addEventListener("push", (event) => {
  let msg = { title: "Nox", body: "", url: "/tasks" };
  try {
    msg = { ...msg, ...event.data.json() };
  } catch {
    /* not JSON: show the default */
  }
  const url = typeof msg.url === "string" && msg.url.startsWith("/") ? msg.url : "/tasks";
  event.waitUntil(self.registration.showNotification(String(msg.title).slice(0, 120), { body: String(msg.body).slice(0, 300), icon: "/apple-touch-icon.png", data: { url }, tag: msg.kind || "nox" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/tasks";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
