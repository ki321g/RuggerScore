import { NextResponse } from 'next/server';
import { registerUser, signIn } from '@/lib/auth';

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as {
		email?: string;
		password?: string;
		name?: string;
	} | null;
	if (!body?.email || !body?.password)
		return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
	const res = await registerUser({
		email: body.email,
		password: body.password,
		name: body.name,
	});
	if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
	// Sign the user in immediately. signIn will set the auth cookie.
	try {
		await signIn('credentials', {
			email: body.email,
			password: body.password,
			redirect: false,
		});
	} catch {
		/* swallow — caller can sign in manually */
	}
	return NextResponse.json({ ok: true });
}
