import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { persistence } from '@/lib/persistence';
import { store, publicMatch } from '@/lib/matchStore';

export const dynamic = 'force-dynamic';

export async function GET() {
	const session = await auth();
	const userId = (session?.user as { id?: string } | undefined)?.id;
	if (!userId)
		return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

	await store.ready;
	const rows = await persistence.listMatchesForUser(userId);
	const matches = rows
		.map((r) => store.get(r.id))
		.filter((m): m is NonNullable<typeof m> => Boolean(m))
		.map(publicMatch);
	return NextResponse.json({ matches });
}
