'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMatchStream } from '@/lib/useMatchStream';
import { useLiveMinute } from '@/lib/useLiveMinute';
import type { ScoreEventType } from '@/lib/matchStore';

export default function ScorerPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const { match, error } = useMatchStream(id);
	const minute = useLiveMinute(match);
	const [busy, setBusy] = useState(false);

	async function action(body: Record<string, unknown>) {
		setBusy(true);
		try {
			await fetch(`/api/matches/${id}/events`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
		} finally {
			setBusy(false);
		}
	}

	if (!match) {
		return <p className='text-white/60'>{error ?? 'Loading match…'}</p>;
	}

	const shareUrl =
		typeof window !== 'undefined'
			? `${window.location.origin}/m/${match.code}`
			: `/m/${match.code}`;

	return (
		<div className='space-y-6'>
			<div className='rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center justify-between gap-3'>
				<div>
					<p className='text-xs uppercase tracking-wider text-white/50'>
						Share with supporters
					</p>
					<p className='font-mono text-2xl tracking-widest'>{match.code}</p>
				</div>
				<div className='flex flex-wrap gap-2'>
					<button
						onClick={() => navigator.clipboard?.writeText(shareUrl)}
						className='rounded-lg border border-white/20 px-3 py-2 text-sm hover:border-rugby-green'
					>
						Copy link
					</button>
					<Link
						href={`/m/${match.code}`}
						className='rounded-lg border border-white/20 px-3 py-2 text-sm hover:border-rugby-green'
						target='_blank'
					>
						Open spectator view
					</Link>
				</div>
			</div>

			<Scoreboard match={match} minute={minute} />

			<div className='rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center justify-between gap-3'>
				<div className='text-sm text-white/70'>
					Status:{' '}
					<span className='font-semibold text-white'>
						{statusLabel(match.status)}
					</span>
					{' · '}Minute:{' '}
					<span className='font-semibold text-white'>{minute}'</span>
				</div>
				<div className='flex gap-2'>
					{match.status === 'scheduled' && (
						<button
							disabled={busy}
							onClick={() => action({ action: 'start' })}
							className='btn-green'
						>
							Kick-off
						</button>
					)}
					{match.status === 'live' && (
						<button
							disabled={busy}
							onClick={() => action({ action: 'halftime' })}
							className='btn-outline'
						>
							Half-time
						</button>
					)}
					{match.status === 'halftime' && (
						<button
							disabled={busy}
							onClick={() => action({ action: 'start' })}
							className='btn-green'
						>
							Start 2nd half
						</button>
					)}
					{(match.status === 'live' || match.status === 'halftime') && (
						<button
							disabled={busy}
							onClick={() => action({ action: 'fulltime' })}
							className='btn-outline'
						>
							Full-time
						</button>
					)}
					<button
						disabled={busy || match.events.length === 0}
						onClick={() => action({ action: 'undo' })}
						className='btn-outline'
					>
						Undo
					</button>
				</div>
			</div>

			<div className='grid sm:grid-cols-2 gap-3'>
				<TeamScorePad
					team='home'
					name={match.home.name}
					color={match.home.color}
					disabled={busy}
					onScore={(t) => action({ action: 'score', team: 'home', type: t })}
				/>
				<TeamScorePad
					team='away'
					name={match.away.name}
					color={match.away.color}
					disabled={busy}
					onScore={(t) => action({ action: 'score', team: 'away', type: t })}
				/>
			</div>

			<EventLog match={match} />
		</div>
	);
}

function statusLabel(s: string) {
	switch (s) {
		case 'scheduled':
			return 'Pre-match';
		case 'live':
			return 'Live';
		case 'halftime':
			return 'Half-time';
		case 'fulltime':
			return 'Full-time';
		default:
			return s;
	}
}

function Scoreboard({
	match,
	minute,
}: {
	match: import('@/lib/matchStore').PublicMatch;
	minute: number;
}) {
	return (
		<div className='rounded-xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-5'>
			<div className='text-center text-xs uppercase tracking-widest text-white/50'>
				{match.competition ?? 'Match'} · {statusLabel(match.status)} · {minute}'
			</div>
			<div className='mt-3 grid grid-cols-3 items-center gap-3'>
				<TeamHead
					name={match.home.name}
					color={match.home.color}
					align='right'
				/>
				<div className='text-center text-5xl sm:text-6xl font-extrabold tabular-nums'>
					{match.scores.home}
					<span className='text-white/40 mx-2'>–</span>
					{match.scores.away}
				</div>
				<TeamHead
					name={match.away.name}
					color={match.away.color}
					align='left'
				/>
			</div>
		</div>
	);
}

function TeamHead({
	name,
	color,
	align,
}: {
	name: string;
	color: string;
	align: 'left' | 'right';
}) {
	return (
		<div className={align === 'right' ? 'text-right' : 'text-left'}>
			<div className='inline-flex items-center gap-2'>
				{align === 'left' && (
					<span
						className='inline-block h-4 w-4 rounded'
						style={{ background: color }}
					/>
				)}
				<span className='font-semibold'>{name}</span>
				{align === 'right' && (
					<span
						className='inline-block h-4 w-4 rounded'
						style={{ background: color }}
					/>
				)}
			</div>
		</div>
	);
}

const SCORE_BUTTONS: { type: ScoreEventType; label: string; sub: string }[] = [
	{ type: 'try', label: 'Try', sub: '+5' },
	{ type: 'conversion', label: 'Conv', sub: '+2' },
	{ type: 'penalty', label: 'Penalty', sub: '+3' },
	{ type: 'drop', label: 'Drop goal', sub: '+3' },
];

function TeamScorePad(props: {
	team: 'home' | 'away';
	name: string;
	color: string;
	disabled: boolean;
	onScore: (t: ScoreEventType) => void;
}) {
	return (
		<div className='rounded-xl border border-white/10 bg-white/5 p-3'>
			<div className='flex items-center gap-2 mb-3'>
				<span
					className='inline-block h-5 w-5 rounded'
					style={{ background: props.color }}
				/>
				<h3 className='font-semibold'>{props.name}</h3>
			</div>
			<div className='grid grid-cols-2 gap-2'>
				{SCORE_BUTTONS.map((b) => (
					<button
						key={b.type}
						disabled={props.disabled}
						onClick={() => props.onScore(b.type)}
						className='rounded-xl bg-rugby-green py-5 font-bold text-lg active:scale-95 hover:bg-emerald-600 disabled:opacity-50'
					>
						{b.label}{' '}
						<span className='text-emerald-200 font-mono text-sm'>{b.sub}</span>
					</button>
				))}
				<button
					disabled={props.disabled}
					onClick={() => props.onScore('yellow')}
					className='rounded-xl bg-yellow-600 py-3 font-semibold text-sm hover:bg-yellow-500 disabled:opacity-50'
				>
					Yellow card
				</button>
				<button
					disabled={props.disabled}
					onClick={() => props.onScore('red')}
					className='rounded-xl bg-red-700 py-3 font-semibold text-sm hover:bg-red-600 disabled:opacity-50'
				>
					Red card
				</button>
			</div>
		</div>
	);
}

function EventLog({
	match,
}: {
	match: import('@/lib/matchStore').PublicMatch;
}) {
	if (match.events.length === 0) {
		return <p className='text-sm text-white/50'>No events yet.</p>;
	}
	return (
		<div className='rounded-xl border border-white/10 bg-white/5 p-4'>
			<h3 className='font-semibold mb-2'>Event timeline</h3>
			<ul className='space-y-1 text-sm'>
				{[...match.events].reverse().map((e) => (
					<li
						key={e.id}
						className='flex items-center justify-between border-b border-white/5 pb-1'
					>
						<span className='tabular-nums w-12 text-white/60'>
							{e.matchMinute}'
						</span>
						<span className='flex-1'>
							{e.team === 'home' ? match.home.name : match.away.name}
							<span className='text-white/60'> · {labelFor(e.type)}</span>
						</span>
						{e.points > 0 && (
							<span className='font-mono text-emerald-300'>+{e.points}</span>
						)}
					</li>
				))}
			</ul>
		</div>
	);
}

function labelFor(t: ScoreEventType) {
	switch (t) {
		case 'try':
			return 'Try';
		case 'conversion':
			return 'Conversion';
		case 'penalty':
			return 'Penalty goal';
		case 'drop':
			return 'Drop goal';
		case 'yellow':
			return 'Yellow card';
		case 'red':
			return 'Red card';
	}
}
