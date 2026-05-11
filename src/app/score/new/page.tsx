'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { myMatches } from '@/lib/myMatches';

export default function NewMatchPage() {
	const router = useRouter();
	const [homeName, setHomeName] = useState('');
	const [awayName, setAwayName] = useState('');
	const [competition, setCompetition] = useState('');
	const [venue, setVenue] = useState('');
	const [kickOff, setKickOff] = useState(''); // local datetime string
	const [homeColor, setHomeColor] = useState('#0a6b3a');
	const [awayColor, setAwayColor] = useState('#1e3a8a');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const res = await fetch('/api/matches', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					homeName,
					awayName,
					homeColor,
					awayColor,
					competition,
					venue,
					kickOffAt: kickOff ? new Date(kickOff).getTime() : undefined,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Failed to create match');
			myMatches.add(data.match.id, data.match.code);
			router.push(`/score/${data.match.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to create match');
			setBusy(false);
		}
	}

	return (
		<div className='max-w-md mx-auto'>
			<h1 className='text-2xl font-bold mb-1'>New match</h1>
			<p className='text-white/60 text-sm mb-6'>
				Set up in under 30 seconds. You can edit later.
			</p>
			<form onSubmit={submit} className='space-y-4'>
				<Field label='Home team'>
					<input
						required
						value={homeName}
						onChange={(e) => setHomeName(e.target.value)}
						className='input'
						placeholder='e.g. Waterford RFC'
					/>
				</Field>
				<Field label='Away team'>
					<input
						required
						value={awayName}
						onChange={(e) => setAwayName(e.target.value)}
						className='input'
						placeholder='e.g. Clonmel RFC'
					/>
				</Field>
				<div className='grid grid-cols-2 gap-3'>
					<Field label='Home colour'>
						<input
							type='color'
							value={homeColor}
							onChange={(e) => setHomeColor(e.target.value)}
							className='h-11 w-full rounded-lg bg-transparent'
						/>
					</Field>
					<Field label='Away colour'>
						<input
							type='color'
							value={awayColor}
							onChange={(e) => setAwayColor(e.target.value)}
							className='h-11 w-full rounded-lg bg-transparent'
						/>
					</Field>
				</div>
				<Field label='Competition (optional)'>
					<input
						value={competition}
						onChange={(e) => setCompetition(e.target.value)}
						className='input'
						placeholder='e.g. Munster Junior League'
					/>
				</Field>
				<Field label='Venue (optional)'>
					<input
						value={venue}
						onChange={(e) => setVenue(e.target.value)}
						className='input'
						placeholder='e.g. Waterpark, Waterford'
					/>
				</Field>
				<Field label='Kick-off (optional)'>
					<input
						type='datetime-local'
						value={kickOff}
						onChange={(e) => setKickOff(e.target.value)}
						className='input'
					/>
				</Field>
				{error && <p className='text-red-400 text-sm'>{error}</p>}
				<button
					type='submit'
					disabled={busy}
					className='w-full rounded-lg bg-rugby-green py-3 font-semibold disabled:opacity-50 hover:bg-emerald-600'
				>
					{busy ? 'Creating…' : 'Create match'}
				</button>
			</form>
		</div>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<label className='block text-sm'>
			<span className='block mb-1 text-white/70'>{label}</span>
			{children}
		</label>
	);
}
