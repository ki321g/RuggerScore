import { NextResponse } from 'next/server';
import { pushService } from '@/lib/pushService';

export const dynamic = 'force-dynamic';

interface UnsubscribeBody {
	endpoint: string;
	matchId?: string;
}

export async function POST(req: Request) {
	let body: UnsubscribeBody;
	try {
		body = (await req.json()) as UnsubscribeBody;
	} catch {
		return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
	}
	if (!body?.endpoint) {
		return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
	}
	await pushService.unsubscribe(body.endpoint, body.matchId);
	return NextResponse.json({ ok: true });
}
