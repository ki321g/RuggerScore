import { NextResponse } from 'next/server';
import { pushService } from '@/lib/pushService';
import { store } from '@/lib/matchStore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
	let body: { matchId?: string };
	try {
		body = (await req.json()) as { matchId?: string };
	} catch {
		return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
	}
	if (!body?.matchId) {
		return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
	}
	await store.ready;
	const m = store.get(body.matchId) ?? store.getByCode(body.matchId);
	if (!m) {
		return NextResponse.json({ error: 'match_not_found' }, { status: 404 });
	}
	const result = await pushService.sendToMatch(m.id, {
		title: 'RugbyScore test',
		body: `${m.home.name} vs ${m.away.name} — notifications are working.`,
		url: `/m/${m.id}`,
		tag: `match-${m.id}-test`,
	});
	return NextResponse.json({ ok: true, ...result });
}
