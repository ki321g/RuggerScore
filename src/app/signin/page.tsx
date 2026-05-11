'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function SignInPage() {
	return (
		<Suspense fallback={null}>
			<SignInForm />
		</Suspense>
	);
}

function SignInForm() {
	const router = useRouter();
	const params = useSearchParams();
	const callbackUrl = params.get('callbackUrl') || '/club-admin';
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setBusy(true);
		const res = await signIn('credentials', {
			email,
			password,
			redirect: false,
		});
		setBusy(false);
		if (res?.error) {
			setError('Invalid email or password.');
			return;
		}
		router.push(callbackUrl);
		router.refresh();
	}

	return (
		<div className='mx-auto max-w-sm py-12 px-4'>
			<h1 className='text-2xl font-bold mb-6'>Sign in</h1>
			<form onSubmit={onSubmit} className='space-y-4'>
				<div>
					<label className='block text-sm mb-1'>Email</label>
					<input
						type='email'
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className='input'
						autoComplete='email'
					/>
				</div>
				<div>
					<label className='block text-sm mb-1'>Password</label>
					<input
						type='password'
						required
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className='input'
						autoComplete='current-password'
					/>
				</div>
				{error && <p className='text-sm text-red-400'>{error}</p>}
				<button type='submit' disabled={busy} className='btn-green w-full'>
					{busy ? 'Signing in…' : 'Sign in'}
				</button>
			</form>
			<p className='text-sm text-white/60 mt-6'>
				No account?{' '}
				<Link
					href={`/signup${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}
					className='underline'
				>
					Create one
				</Link>
			</p>
		</div>
	);
}
