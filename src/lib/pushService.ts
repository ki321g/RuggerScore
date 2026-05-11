import 'server-only';
import webpush from 'web-push';
import { persistence } from './persistence';
import type { Match, ScoreEvent } from './matchStore';

const VAPID_SUBJECT =
	process.env.VAPID_SUBJECT || 'mailto:admin@rugbyscore.local';

interface VapidKeys {
	publicKey: string;
	privateKey: string;
}

async function loadOrCreateVapid(): Promise<VapidKeys> {
	const envPub = process.env.VAPID_PUBLIC_KEY;
	const envPriv = process.env.VAPID_PRIVATE_KEY;
	if (envPub && envPriv) {
		return { publicKey: envPub, privateKey: envPriv };
	}
	const existing = await persistence.kvGet('vapid');
	if (existing) {
		try {
			return JSON.parse(existing) as VapidKeys;
		} catch {
			/* regenerate */
		}
	}
	const keys = webpush.generateVAPIDKeys();
	await persistence.kvSet('vapid', JSON.stringify(keys));
	return keys;
}

const g = globalThis as unknown as {
	__rugbyScoreVapid?: Promise<VapidKeys>;
};
function getVapid(): Promise<VapidKeys> {
	if (g.__rugbyScoreVapid) return g.__rugbyScoreVapid;
	g.__rugbyScoreVapid = (async () => {
		const keys = await loadOrCreateVapid();
		webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
		return keys;
	})();
	return g.__rugbyScoreVapid;
}

export const pushService = {
	async publicKey(): Promise<string> {
		return (await getVapid()).publicKey;
	},

	async subscribe(
		matchId: string,
		sub: { endpoint: string; keys: { p256dh: string; auth: string } },
	) {
		await persistence.addPushSubscription(
			matchId,
			sub.endpoint,
			sub.keys.p256dh,
			sub.keys.auth,
		);
	},

	async unsubscribe(endpoint: string, matchId?: string) {
		await persistence.removePushSubscription(endpoint, matchId);
	},

	async sendToMatch(
		matchId: string,
		payload: PushPayload,
	): Promise<{ sent: number; failed: number; subscribers: number }> {
		await getVapid();
		const subs = await persistence.listPushSubscriptions(matchId);
		console.log(
			`[push] sendToMatch match=${matchId} subscribers=${subs.length} title="${payload.title}"`,
		);
		if (subs.length === 0) return { sent: 0, failed: 0, subscribers: 0 };
		const body = JSON.stringify(payload);
		let sent = 0;
		let failed = 0;
		await Promise.all(
			subs.map(async (s) => {
				try {
					await webpush.sendNotification(
						{
							endpoint: s.endpoint,
							keys: { p256dh: s.p256dh, auth: s.auth },
						},
						body,
					);
					sent++;
				} catch (err: unknown) {
					failed++;
					const statusCode =
						err && typeof err === 'object' && 'statusCode' in err
							? (err as { statusCode: number }).statusCode
							: 0;
					if (statusCode === 404 || statusCode === 410) {
						console.warn(
							`[push] endpoint gone (${statusCode}) removing`,
							s.endpoint.slice(0, 60) + '…',
						);
						persistence.removePushSubscription(s.endpoint).catch(() => {});
					} else {
						console.warn('[push] send failed', statusCode, err);
					}
				}
			}),
		);
		console.log(
			`[push] sendToMatch done match=${matchId} sent=${sent} failed=${failed}`,
		);
		return { sent, failed, subscribers: subs.length };
	},
};

export interface PushPayload {
	title: string;
	body: string;
	url: string;
	tag?: string;
}

export function buildEventPayload(m: Match, ev: ScoreEvent): PushPayload {
	const teamName = ev.team === 'home' ? m.home.name : m.away.name;
	const home = m.events
		.filter((e) => e.team === 'home')
		.reduce((s, e) => s + e.points, 0);
	const away = m.events
		.filter((e) => e.team === 'away')
		.reduce((s, e) => s + e.points, 0);
	const eventLabel = (() => {
		switch (ev.type) {
			case 'try':
				return 'Try!';
			case 'conversion':
				return 'Conversion';
			case 'penalty':
				return 'Penalty goal';
			case 'drop':
				return 'Drop goal';
			case 'yellow':
				return 'Yellow card';
			case 'red':
				return 'Red card';
		}
	})();
	return {
		title: `${eventLabel} — ${teamName}`,
		body: `${m.home.name} ${home} – ${away} ${m.away.name} · ${ev.matchMinute}'`,
		url: `/m/${m.id}`,
		tag: `match-${m.id}`,
	};
}

export function buildStatusPayload(
	m: Match,
	status: Match['status'],
): PushPayload {
	const home = m.events
		.filter((e) => e.team === 'home')
		.reduce((s, e) => s + e.points, 0);
	const away = m.events
		.filter((e) => e.team === 'away')
		.reduce((s, e) => s + e.points, 0);
	const title = (() => {
		switch (status) {
			case 'live':
				return m.half === 2 ? 'Second half under way' : 'Kick-off!';
			case 'halftime':
				return 'Half-time';
			case 'fulltime':
				return 'Full-time';
			default:
				return 'Match update';
		}
	})();
	return {
		title: `${title} — ${m.home.name} vs ${m.away.name}`,
		body: `${m.home.name} ${home} – ${away} ${m.away.name}`,
		url: `/m/${m.id}`,
		tag: `match-${m.id}-status`,
	};
}
