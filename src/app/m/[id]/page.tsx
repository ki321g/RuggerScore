'use client';

import { use } from 'react';
import Link from 'next/link';
import { useMatchStream } from '@/lib/useMatchStream';
import { useLiveMinute } from '@/lib/useLiveMinute';
import { useMatchPush } from '@/lib/useMatchPush';
import type { ScoreEventType } from '@/lib/matchStore';

export default function SpectatorPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const { match, error } = useMatchStream(id);
	const minute = useLiveMinute(match);
	const push = useMatchPush(id);

	if (!match) {
		return (
			<p className='text-white/60 text-center py-10'>
				{error ?? 'Loading match…'}
			</p>
		);
	}

	const status = match.status;

	return (
		<div className='space-y-6 max-w-2xl mx-auto'>
			<div className='rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6 shadow-lg'>
				<div className='flex items-center justify-between text-xs uppercase tracking-widest text-white/60'>
					<span>{match.competition ?? 'Friendly'}</span>
					<span className='flex items-center gap-1'>
						{status === 'live' && (
							<span className='h-2 w-2 rounded-full bg-red-500 animate-pulse' />
						)}
						{label(status)} · {minute}'
					</span>
				</div>
				<div className='mt-5 grid grid-cols-3 items-center gap-3'>
					<Side
						name={match.home.name}
						color={match.home.color}
						score={match.scores.home}
						align='right'
					/>
					<div className='text-center text-white/30 text-3xl'>–</div>
					<Side
						name={match.away.name}
						color={match.away.color}
						score={match.scores.away}
						align='left'
					/>
				</div>
				{(match.venue || match.kickOffAt) && (
					<div className='mt-4 flex items-center justify-center gap-3 text-xs text-white/60'>
						{match.kickOffAt && (
							<span>
								KO{' '}
								{new Date(match.kickOffAt).toLocaleString(undefined, {
									weekday: 'short',
									day: 'numeric',
									month: 'short',
									hour: '2-digit',
									minute: '2-digit',
								})}
							</span>
						)}
						{match.venue && <span>· {match.venue}</span>}
					</div>
				)}
			</div>

			<NotifyBanner push={push} matchId={id} />

			<div className='rounded-xl border border-white/10 bg-white/5 p-4'>
				<h2 className='font-semibold mb-2'>Timeline</h2>
				{match.events.length === 0 ? (
					<p className='text-sm text-white/50'>No events yet. Stay tuned…</p>
				) : (
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
									<span className='font-mono text-emerald-300'>
										+{e.points}
									</span>
								)}
							</li>
						))}
					</ul>
				)}
			</div>

			<p className='text-center text-xs text-white/40'>
				Match code{' '}
				<span className='font-mono tracking-widest text-white/70'>
					{match.code}
				</span>
				{' · '}
				<Link href='/' className='underline hover:text-rugby-green'>
					Back to discover
				</Link>
			</p>
		</div>
	);
}

function Side({
	name,
	color,
	score,
	align,
}: {
	name: string;
	color: string;
	score: number;
	align: 'left' | 'right';
}) {
	return (
		<div className={align === 'right' ? 'text-right' : 'text-left'}>
			<div
				className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
			>
				{align === 'left' && (
					<span
						className='inline-block h-5 w-5 rounded'
						style={{ background: color }}
					/>
				)}
				<span className='font-semibold'>{name}</span>
				{align === 'right' && (
					<span
						className='inline-block h-5 w-5 rounded'
						style={{ background: color }}
					/>
				)}
			</div>
			<div className='text-5xl sm:text-6xl font-extrabold tabular-nums mt-2'>
				{score}
			</div>
		</div>
	);
}

function label(s: string) {
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

function NotifyBanner({
	push,
	matchId,
}: {
	push: ReturnType<typeof useMatchPush>;
	matchId: string;
}) {
	if (push.state === 'unsupported') return null;
	if (push.state === 'denied') {
		return (
			<div className='rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-200'>
				Notifications are blocked for this site. Enable them in your browser
				settings to get score alerts.
			</div>
		);
	}
	if (push.state === 'subscribed') {
		return (
			<div className='rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm flex items-center justify-between gap-3 flex-wrap'>
				<span className='flex items-center gap-2'>
					<span className='h-2 w-2 rounded-full bg-emerald-400 animate-pulse' />
					You'll get a notification on every score &amp; status change.
				</span>
				<div className='flex items-center gap-3'>
					<button
						onClick={async () => {
							const r = await fetch('/api/push/test', {
								method: 'POST',
								headers: { 'content-type': 'application/json' },
								body: JSON.stringify({ matchId }),
							});
							const j = await r.json().catch(() => ({}));
							console.log('[push] test result', j);
						}}
						className='text-emerald-200/80 hover:text-emerald-100 underline text-xs'
					>
						Send test
					</button>
					<button
						onClick={push.unsubscribe}
						className='text-emerald-200/80 hover:text-emerald-100 underline text-xs'
					>
						Turn off
					</button>
				</div>
			</div>
		);
	}
	return (
		<div className='rounded-xl border border-white/15 bg-white/5 p-3 text-sm flex items-center justify-between gap-3 flex-wrap'>
			<div>
				<div className='font-semibold'>Get score alerts</div>
				<div className='text-white/60 text-xs'>
					Be notified the moment a try, penalty or full-time happens.
				</div>
			</div>
			<button
				onClick={push.subscribe}
				disabled={push.state === 'subscribing'}
				className='btn-green'
			>
				{push.state === 'subscribing' ? 'Enabling…' : 'Notify me'}
			</button>
			{push.state === 'error' && push.error && (
				<div className='w-full text-xs text-red-300'>Error: {push.error}</div>
			)}
		</div>
	);
}
