import { NextResponse } from 'next/server';
import { pushService } from '@/lib/pushService';
import { store } from '@/lib/matchStore';

export const dynamic = 'force-dynamic';

interface SubscribeBody {
	matchId: string;
	subscription: {
		endpoint: string;
		keys: { p256dh: string; auth: string };
	};
}

export async function POST(req: Request) {
	let body: SubscribeBody;
	try {
		body = (await req.json()) as SubscribeBody;
	} catch {
		return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
	}
	if (
		!body?.matchId ||
		!body?.subscription?.endpoint ||
		!body.subscription.keys
	) {
		return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
	}
	await store.ready;
	const m = store.get(body.matchId) ?? store.getByCode(body.matchId);
	if (!m) {
		return NextResponse.json({ error: 'match_not_found' }, { status: 404 });
	}
	await pushService.subscribe(m.id, body.subscription);
	return NextResponse.json({ ok: true });
}
