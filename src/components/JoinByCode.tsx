'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function JoinByCode() {
	const router = useRouter();
	const [code, setCode] = useState('');
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				const c = code.trim().toUpperCase();
				if (c.length >= 4) router.push(`/m/${c}`);
			}}
			className='flex items-center gap-2'
		>
			<input
				value={code}
				onChange={(e) => setCode(e.target.value.toUpperCase())}
				placeholder='Match code'
				maxLength={8}
				className='rounded-lg border border-white/20 bg-white/5 px-3 py-3 font-mono tracking-widest w-36 uppercase focus:border-rugby-green outline-none'
			/>
			<button
				type='submit'
				className='rounded-lg border border-white/20 bg-white/5 px-4 py-3 font-semibold hover:border-rugby-green'
			>
				Join
			</button>
		</form>
	);
}
