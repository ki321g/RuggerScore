import { NextResponse } from 'next/server';
import { store, publicMatch } from '@/lib/matchStore';
import { auth } from '@/lib/auth';
import { persistence } from '@/lib/persistence';

export const dynamic = 'force-dynamic';

export async function GET() {
	await store.ready;
	return NextResponse.json({ matches: store.list().map(publicMatch) });
}

export async function POST(req: Request) {
	const session = await auth();
	const userId = (session?.user as { id?: string } | undefined)?.id;
	if (!userId)
		return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

	const body = await req.json().catch(() => ({}));
	const homeName = String(body.homeName ?? '').slice(0, 60);
	const awayName = String(body.awayName ?? '').slice(0, 60);
	if (!homeName || !awayName) {
		return NextResponse.json(
			{ error: 'homeName and awayName are required' },
			{ status: 400 },
		);
	}

	// Resolve the club the user is creating this match in.
	const clubs = await persistence.listClubsForUser(userId);
	if (clubs.length === 0) {
		return NextResponse.json({ error: 'no_club' }, { status: 400 });
	}
	let clubId: string;
	if (typeof body.clubId === 'string' && body.clubId) {
		if (!(await persistence.isClubMember(body.clubId, userId))) {
			return NextResponse.json({ error: 'forbidden_club' }, { status: 403 });
		}
		clubId = body.clubId;
	} else {
		clubId = clubs[0].id; // default to first (personal) club
	}

	let kickOffAt: number | undefined;
	if (typeof body.kickOffAt === 'number' && Number.isFinite(body.kickOffAt)) {
		kickOffAt = body.kickOffAt;
	} else if (typeof body.kickOffAt === 'string' && body.kickOffAt.trim()) {
		const t = Date.parse(body.kickOffAt);
		if (!Number.isNaN(t)) kickOffAt = t;
	}
	await store.ready;
	const m = await store.create({
		homeName,
		awayName,
		homeColor: typeof body.homeColor === 'string' ? body.homeColor : undefined,
		awayColor: typeof body.awayColor === 'string' ? body.awayColor : undefined,
		competition:
			typeof body.competition === 'string' ? body.competition : undefined,
		kickOffAt,
		venue:
			typeof body.venue === 'string' ? body.venue.slice(0, 120) : undefined,
		clubId,
		createdByUserId: userId,
	});
	return NextResponse.json({ match: publicMatch(m) }, { status: 201 });
}
