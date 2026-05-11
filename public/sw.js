// Minimal PWA service worker - app shell + offline fallback + Web Push.
const CACHE = 'rugbyscore-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((c) => c.addAll(SHELL))
			.catch(() => {}),
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
				),
			),
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	// Never cache SSE/API
	if (url.pathname.startsWith('/api/')) return;
	event.respondWith(
		fetch(req)
			.then((res) => {
				const copy = res.clone();
				caches
					.open(CACHE)
					.then((c) => c.put(req, copy))
					.catch(() => {});
				return res;
			})
			.catch(() => caches.match(req).then((r) => r || caches.match('/'))),
	);
});

self.addEventListener('push', (event) => {
	let payload = {};
	try {
		payload = event.data ? event.data.json() : {};
	} catch {
		payload = {
			title: 'RugbyScore',
			body: event.data ? event.data.text() : '',
		};
	}
	const title = payload.title || 'RugbyScore';
	const options = {
		body: payload.body || '',
		icon: '/icon.svg',
		badge: '/icon.svg',
		tag: payload.tag,
		renotify: !!payload.tag,
		data: { url: payload.url || '/' },
	};
	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = (event.notification.data && event.notification.data.url) || '/';
	event.waitUntil(
		self.clients
			.matchAll({ type: 'window', includeUncontrolled: true })
			.then((wins) => {
				for (const w of wins) {
					if ('focus' in w) {
						w.navigate(url).catch(() => {});
						return w.focus();
					}
				}
				return self.clients.openWindow(url);
			}),
	);
});
