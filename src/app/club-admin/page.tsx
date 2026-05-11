'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { PublicMatch } from '@/lib/matchStore';

export default function ClubAdminPage() {
	const [matches, setMatches] = useState<PublicMatch[]>([]);
	const [loading, setLoading] = useState(true);
	const [busyId, setBusyId] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const res = await fetch('/api/my/matches', { cache: 'no-store' });
			if (!res.ok) return;
			const data = await res.json();
			setMatches((data.matches ?? []) as PublicMatch[]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
		const i = setInterval(load, 10_000);
		return () => clearInterval(i);
	}, [load]);

	async function action(id: string, body: Record<string, unknown>) {
		setBusyId(id);
		try {
			await fetch(`/api/matches/${id}/events`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			await load();
		} finally {
			setBusyId(null);
		}
	}

	return (
		<div className='max-w-3xl mx-auto space-y-6'>
			<div className='flex items-end justify-between flex-wrap gap-3'>
				<div>
					<h1 className='text-2xl font-bold'>Club portal</h1>
					<p className='text-white/60 text-sm'>
						Matches you've created across your clubs.
					</p>
				</div>
				<Link href='/score/new' className='btn-green'>
					+ New match
				</Link>
			</div>

			{loading ? (
				<p className='text-white/40 text-sm'>Loading…</p>
			) : matches.length === 0 ? (
				<EmptyState />
			) : (
				<ul className='space-y-3'>
					{matches.map((match) => (
						<li
							key={match.id}
							className='rounded-xl border border-white/10 bg-white/5 p-4'
						>
							<MatchRow
								match={match}
								busy={busyId === match.id}
								onAction={(body) => action(match.id, body)}
							/>
						</li>
					))}
				</ul>
			)}

			<RoadmapNote />
		</div>
	);
}

function MatchRow({
	match,
	busy,
	onAction,
}: {
	match: PublicMatch;
	busy: boolean;
	onAction: (body: Record<string, unknown>) => void;
}) {
	const isLive = match.status === 'live' || match.status === 'halftime';
	const shareUrl =
		typeof window !== 'undefined'
			? `${window.location.origin}/m/${match.code}`
			: `/m/${match.code}`;

	return (
		<div className='space-y-3'>
			<div className='flex items-center justify-between gap-3 flex-wrap'>
				<div className='flex items-center gap-3 min-w-0'>
					<StatusPill status={match.status} />
					<div className='min-w-0'>
						<p className='font-semibold truncate'>
							{match.home.name} <span className='text-white/40'>vs</span>{' '}
							{match.away.name}
						</p>
						<p className='text-xs text-white/50 truncate'>
							{match.competition ?? 'Friendly'} · Code{' '}
							<span className='font-mono tracking-widest'>{match.code}</span>
						</p>
						{(match.venue || match.kickOffAt) && (
							<p className='text-xs text-white/40 truncate'>
								{match.kickOffAt &&
									new Date(match.kickOffAt).toLocaleString(undefined, {
										weekday: 'short',
										day: 'numeric',
										month: 'short',
										hour: '2-digit',
										minute: '2-digit',
									})}
								{match.kickOffAt && match.venue && ' · '}
								{match.venue}
							</p>
						)}
					</div>
				</div>
				<div className='text-2xl font-extrabold tabular-nums'>
					{match.scores.home}
					<span className='text-white/40 mx-1.5'>–</span>
					{match.scores.away}
				</div>
			</div>

			<div className='flex flex-wrap gap-2 text-sm'>
				<Link href={`/score/${match.id}`} className='btn-outline'>
					Open scorer
				</Link>
				<Link href={`/m/${match.code}`} className='btn-outline' target='_blank'>
					Spectator view
				</Link>
				<button
					onClick={() => navigator.clipboard?.writeText(shareUrl)}
					className='btn-outline'
				>
					Copy link
				</button>
				{match.status === 'scheduled' && (
					<button
						disabled={busy}
						onClick={() => onAction({ action: 'start' })}
						className='btn-green'
					>
						Kick-off
					</button>
				)}
				{match.status === 'live' && (
					<button
						disabled={busy}
						onClick={() => onAction({ action: 'halftime' })}
						className='btn-outline'
					>
						Half-time
					</button>
				)}
				{match.status === 'halftime' && (
					<button
						disabled={busy}
						onClick={() => onAction({ action: 'start' })}
						className='btn-green'
					>
						2nd half
					</button>
				)}
				{isLive && (
					<button
						disabled={busy}
						onClick={() => onAction({ action: 'fulltime' })}
						className='btn-outline'
					>
						Full-time
					</button>
				)}
			</div>
		</div>
	);
}

function StatusPill({ status }: { status: PublicMatch['status'] }) {
	const map: Record<
		PublicMatch['status'],
		{ label: string; className: string }
	> = {
		scheduled: { label: 'Scheduled', className: 'bg-white/10 text-white/70' },
		live: {
			label: 'LIVE',
			className: 'bg-red-500/20 text-red-300 border border-red-500/30',
		},
		halftime: {
			label: 'HT',
			className: 'bg-amber-500/20 text-amber-200 border border-amber-500/30',
		},
		fulltime: {
			label: 'FT',
			className:
				'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30',
		},
	};
	const v = map[status];
	return (
		<span
			className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${v.className}`}
		>
			{v.label}
		</span>
	);
}

function EmptyState() {
	return (
		<div className='rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center'>
			<p className='text-white/70'>No matches yet on your account.</p>
			<p className='text-sm text-white/40 mt-1'>
				Start your first match and it'll show up here.
			</p>
			<Link href='/score/new' className='btn-green inline-block mt-4'>
				+ New match
			</Link>
		</div>
	);
}

function RoadmapNote() {
	return (
		<details className='rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm'>
			<summary className='cursor-pointer text-white/60'>
				Coming next to the club portal
			</summary>
			<ul className='list-disc pl-5 text-white/50 mt-2 space-y-1'>
				<li>Club profile (crest, colours, location)</li>
				<li>Invite teammates to score for your club</li>
				<li>Team management (Senior XV, Women's, U18…)</li>
				<li>Fixtures with opponent, date, venue</li>
				<li>Season dashboard — W/L, points for/against</li>
				<li>Sponsor banner management</li>
			</ul>
		</details>
	);
}
