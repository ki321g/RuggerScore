import { NextResponse } from 'next/server';
import { store, publicMatch, type ScoreEventType } from '@/lib/matchStore';
import { auth } from '@/lib/auth';
import { persistence } from '@/lib/persistence';

export const dynamic = 'force-dynamic';

type Action =
	| { action: 'start' }
	| { action: 'halftime' }
	| { action: 'fulltime' }
	| { action: 'undo' }
	| { action: 'score'; team: 'home' | 'away'; type: ScoreEventType };

export async function POST(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	await store.ready;
	const m = store.get(id) ?? store.getByCode(id);
	if (!m)
		return NextResponse.json({ error: 'Match not found' }, { status: 404 });

	const session = await auth();
	const userId = (session?.user as { id?: string } | undefined)?.id;
	if (!userId)
		return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
	// Matches created before auth was added have no clubId — any signed-in
	// user can still score those (legacy). New matches require club membership.
	if (m.clubId && !(await persistence.isClubMember(m.clubId, userId))) {
		return NextResponse.json({ error: 'forbidden' }, { status: 403 });
	}

	const body = (await req.json().catch(() => ({}))) as Partial<Action>;
	let updated;
	switch (body.action) {
		case 'start':
			updated = await store.startMatch(m.id);
			break;
		case 'halftime':
			updated = await store.halfTime(m.id);
			break;
		case 'fulltime':
			updated = await store.fullTime(m.id);
			break;
		case 'undo':
			updated = await store.undoLast(m.id);
			break;
		case 'score': {
			if (body.team !== 'home' && body.team !== 'away') {
				return NextResponse.json(
					{ error: "team must be 'home' or 'away'" },
					{ status: 400 },
				);
			}
			const allowed: ScoreEventType[] = [
				'try',
				'conversion',
				'penalty',
				'drop',
				'yellow',
				'red',
			];
			if (!body.type || !allowed.includes(body.type)) {
				return NextResponse.json(
					{ error: 'invalid event type' },
					{ status: 400 },
				);
			}
			updated = await store.addEvent(m.id, body.team, body.type);
			break;
		}
		default:
			return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
	}
	return NextResponse.json({ match: publicMatch(updated!) });
}
