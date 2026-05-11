'use client';

import { useCallback, useEffect, useState } from 'react';

export type PushState =
	| 'unsupported'
	| 'denied'
	| 'idle'
	| 'subscribing'
	| 'subscribed'
	| 'error';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(b64);
	const buf = new ArrayBuffer(raw.length);
	const out = new Uint8Array(buf);
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
	// Try to use an existing registration first (avoids hanging on .ready
	// if the SW was never registered, e.g. when this hook runs before
	// RegisterSW has had a chance to call register()).
	const existing = await navigator.serviceWorker.getRegistration('/');
	if (existing) {
		if (existing.active) return existing;
		// Wait for it to activate, with a timeout fallback.
		const ready = navigator.serviceWorker.ready;
		const timeout = new Promise<ServiceWorkerRegistration>((_, reject) =>
			setTimeout(() => reject(new Error('sw_activation_timeout')), 8000),
		);
		return Promise.race([ready, timeout]);
	}
	// No registration yet — register now.
	const reg = await navigator.serviceWorker.register('/sw.js');
	if (reg.active) return reg;
	const ready = navigator.serviceWorker.ready;
	const timeout = new Promise<ServiceWorkerRegistration>((_, reject) =>
		setTimeout(() => reject(new Error('sw_activation_timeout')), 8000),
	);
	return Promise.race([ready, timeout]);
}

export function useMatchPush(matchId: string) {
	const [state, setState] = useState<PushState>('idle');
	const [error, setError] = useState<string | null>(null);

	const optOutKey = `push:opt-out:${matchId}`;

	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
			setState('unsupported');
			return;
		}
		if (Notification.permission === 'denied') {
			setState('denied');
			return;
		}
		(async () => {
			try {
				const reg = await getServiceWorkerRegistration();
				const sub = await reg.pushManager.getSubscription();
				if (sub) {
					// Respect a previous per-match opt-out on this device.
					if (localStorage.getItem(optOutKey) === '1') {
						setState('idle');
						return;
					}
					setState('subscribed');
					// Ensure this browser sub is registered against the *current* match.
					// One PushSubscription per origin is reused across matches, so
					// without this, navigating to a new match would show "subscribed"
					// but the server would have zero subscribers for it.
					fetch('/api/push/subscribe', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ matchId, subscription: sub.toJSON() }),
					}).catch(() => {});
				}
			} catch (err) {
				console.warn('[push] init failed', err);
			}
		})();
	}, [matchId, optOutKey]);

	const subscribe = useCallback(async () => {
		setError(null);
		setState('subscribing');
		try {
			if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
				setState('unsupported');
				return;
			}
			const perm = await Notification.requestPermission();
			if (perm !== 'granted') {
				setState(perm === 'denied' ? 'denied' : 'idle');
				return;
			}
			const reg = await getServiceWorkerRegistration();
			const res = await fetch('/api/push/vapid');
			if (!res.ok) throw new Error('vapid_fetch_failed');
			const { publicKey } = (await res.json()) as { publicKey: string };
			let sub = await reg.pushManager.getSubscription();
			if (!sub) {
				sub = await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(publicKey),
				});
			}
			const subscribeRes = await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ matchId, subscription: sub.toJSON() }),
			});
			if (!subscribeRes.ok) throw new Error('subscribe_failed');
			localStorage.removeItem(optOutKey);
			setState('subscribed');
		} catch (e: unknown) {
			console.warn('[push] subscribe failed', e);
			setError(e instanceof Error ? e.message : 'unknown_error');
			setState('error');
		}
	}, [matchId, optOutKey]);

	const unsubscribe = useCallback(async () => {
		try {
			const reg = await getServiceWorkerRegistration();
			const sub = await reg.pushManager.getSubscription();
			if (sub) {
				// Per-match unsubscribe: only remove the server-side mapping for
				// this match. Keep the browser PushSubscription alive so other
				// matches the user is following keep getting notifications.
				await fetch('/api/push/unsubscribe', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ endpoint: sub.endpoint, matchId }),
				}).catch(() => {});
			}
			localStorage.setItem(optOutKey, '1');
			setState('idle');
		} catch (e: unknown) {
			console.warn('[push] unsubscribe failed', e);
			setError(e instanceof Error ? e.message : 'unknown_error');
			setState('error');
		}
	}, [matchId, optOutKey]);

	return { state, error, subscribe, unsubscribe };
}
