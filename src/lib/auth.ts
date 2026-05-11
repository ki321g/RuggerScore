import 'server-only';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import { persistence } from './persistence';
import { authConfig } from './auth.config';

const userIdGen = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);
const clubIdGen = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);
const slugGen = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'club'
	);
}

export async function registerUser(input: {
	email: string;
	password: string;
	name?: string;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
	const email = input.email.trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return { ok: false, error: 'invalid_email' };
	if (input.password.length < 8) return { ok: false, error: 'weak_password' };
	if (await persistence.getUserByEmail(email))
		return { ok: false, error: 'email_in_use' };
	const id = userIdGen();
	const hash = await bcrypt.hash(input.password, 10);
	await persistence.createUser({
		id,
		email,
		name: input.name?.trim() || null,
		passwordHash: hash,
	});
	// Auto-create a personal club so the user can start scoring immediately.
	const clubName = (input.name?.trim() || email.split('@')[0]) + "'s club";
	const baseSlug = slugify(clubName);
	const slug = `${baseSlug}-${slugGen()}`;
	await persistence.createClub({
		id: clubIdGen(),
		name: clubName,
		slug,
		createdBy: id,
	});
	return { ok: true, userId: id };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
	...authConfig,
	providers: [
		Credentials({
			name: 'Credentials',
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' },
			},
			async authorize(credentials) {
				const email =
					typeof credentials?.email === 'string'
						? credentials.email.trim().toLowerCase()
						: '';
				const password =
					typeof credentials?.password === 'string' ? credentials.password : '';
				if (!email || !password) return null;
				const user = await persistence.getUserByEmail(email);
				if (!user) return null;
				const ok = await bcrypt.compare(password, user.password_hash);
				if (!ok) return null;
				return { id: user.id, email: user.email, name: user.name ?? undefined };
			},
		}),
	],
});
