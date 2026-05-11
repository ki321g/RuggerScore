import type { NextAuthConfig } from 'next-auth';

// Edge-safe config (no DB, no bcrypt). Used by middleware.
export const authConfig: NextAuthConfig = {
	session: { strategy: 'jwt' },
	pages: { signIn: '/signin' },
	providers: [],
	callbacks: {
		async jwt({ token, user }) {
			if (user) token.uid = (user as { id?: string }).id;
			return token;
		},
		async session({ session, token }) {
			if (token.uid && session.user) {
				(session.user as { id?: string }).id = token.uid as string;
			}
			return session;
		},
	},
};
