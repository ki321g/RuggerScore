import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
	const url = req.nextUrl;
	const path = url.pathname;
	if (req.auth) return NextResponse.next();
	const signInUrl = new URL('/signin', url);
	signInUrl.searchParams.set('callbackUrl', path + url.search);
	return NextResponse.redirect(signInUrl);
});

export const config = {
	matcher: ['/score/:path*', '/club-admin'],
};
