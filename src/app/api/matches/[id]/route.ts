import { NextResponse } from 'next/server';
import { store, publicMatch } from '@/lib/matchStore';

export const dynamic = 'force-dynamic';

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	await store.ready;
	// Resolve id-or-code via cache, then reload from DB so we don't serve
	// stale state from another serverless instance.
	const cached = store.get(id) ?? store.getByCode(id);
	const targetId = cached?.id ?? id;
	const m = (await store.reload(targetId)) ?? store.getByCode(id);
	if (!m)
		return NextResponse.json({ error: 'Match not found' }, { status: 404 });
	return NextResponse.json({ match: publicMatch(m) });
}
