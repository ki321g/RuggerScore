'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function SignUpPage() {
	return (
		<Suspense fallback={null}>
			<SignUpForm />
		</Suspense>
	);
}

function SignUpForm() {
	const router = useRouter();
	const params = useSearchParams();
	const callbackUrl = params.get('callbackUrl') || '/club-admin';
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setBusy(true);
		const res = await fetch('/api/auth/signup', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name, email, password }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			setBusy(false);
			setError(
				data?.error === 'email_in_use'
					? 'That email is already registered.'
					: data?.error === 'weak_password'
						? 'Password must be at least 8 characters.'
						: data?.error === 'invalid_email'
							? 'Please enter a valid email.'
							: 'Could not create account.',
			);
			return;
		}
		// Sign in after signup (server-side signIn cookie may not stick on the
		// client redirect, so do an explicit client-side signIn).
		await signIn('credentials', { email, password, redirect: false });
		setBusy(false);
		router.push(callbackUrl);
		router.refresh();
	}

	return (
		<div className='mx-auto max-w-sm py-12 px-4'>
			<h1 className='text-2xl font-bold mb-6'>Create account</h1>
			<form onSubmit={onSubmit} className='space-y-4'>
				<div>
					<label className='block text-sm mb-1'>Name (optional)</label>
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						className='input'
						autoComplete='name'
					/>
				</div>
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
						minLength={8}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className='input'
						autoComplete='new-password'
					/>
					<p className='text-xs text-white/40 mt-1'>At least 8 characters.</p>
				</div>
				{error && <p className='text-sm text-red-400'>{error}</p>}
				<button type='submit' disabled={busy} className='btn-green w-full'>
					{busy ? 'Creating…' : 'Create account'}
				</button>
			</form>
			<p className='text-sm text-white/60 mt-6'>
				Already have an account?{' '}
				<Link
					href={`/signin${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}
					className='underline'
				>
					Sign in
				</Link>
			</p>
		</div>
	);
}
