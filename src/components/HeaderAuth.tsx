'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';

export function HeaderAuth() {
	const { data, status } = useSession();
	if (status === 'loading') {
		return <span className='text-xs text-white/40'>…</span>;
	}
	if (!data?.user) {
		return (
			<Link href='/signin' className='hover:text-rugby-green'>
				Sign in
			</Link>
		);
	}
	const label = data.user.name || data.user.email || 'Account';
	return (
		<div className='flex items-center gap-3'>
			<span className='text-white/60 hidden sm:inline'>{label}</span>
			<button
				type='button'
				onClick={() => signOut({ callbackUrl: '/' })}
				className='hover:text-rugby-green'
			>
				Sign out
			</button>
		</div>
	);
}
