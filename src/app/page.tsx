import Link from 'next/link';
import { store, publicMatch } from '@/lib/matchStore';
import { JoinByCode } from '@/components/JoinByCode';

export const dynamic = 'force-dynamic';

export default function HomePage() {
	const matches = store.list().map(publicMatch);
	const live = matches.filter(
		(m) => m.status === 'live' || m.status === 'halftime',
	);
	const recent = matches.filter((m) => m.status === 'fulltime').slice(0, 6);

	return (
		<div className='space-y-10'>
			<section className='text-center pt-6 pb-8'>
				<h1 className='text-4xl sm:text-5xl font-extrabold tracking-tight'>
					Live grassroots <span className='text-rugby-green'>rugby</span> scores
				</h1>
				<p className='mt-3 text-white/70 max-w-2xl mx-auto'>
					Score a match pitch-side. Share a link. Your supporters follow live —
					no app install, no sign up.
				</p>
				<div className='mt-6 flex flex-wrap justify-center gap-3'>
					<Link
						href='/score/new'
						className='rounded-lg bg-rugby-green px-5 py-3 font-semibold hover:bg-emerald-600'
					>
						Score a match
					</Link>
					<JoinByCode />
				</div>
			</section>

			<section>
				<div className='flex items-baseline justify-between mb-3'>
					<h2 className='text-xl font-semibold'>
						Live now
						<span className='ml-2 inline-flex items-center gap-1 text-sm text-white/60'>
							<span className='h-2 w-2 rounded-full bg-red-500 animate-pulse' />
							{live.length}
						</span>
					</h2>
				</div>
				{live.length === 0 ? (
					<p className='text-white/60 text-sm'>
						No matches in progress right now. Be the first to start one.
					</p>
				) : (
					<ul className='grid sm:grid-cols-2 gap-3'>
						{live.map((m) => (
							<li key={m.id}>
								<Link
									href={`/m/${m.code}`}
									className='block rounded-lg border border-white/10 bg-white/5 p-4 hover:border-rugby-green'
								>
									<div className='flex items-center justify-between text-xs text-white/60'>
										<span>{m.competition ?? 'Friendly'}</span>
										<span className='text-red-400'>
											{m.status === 'halftime' ? 'HT' : `${m.minute}'`}
										</span>
									</div>
									<div className='mt-2 flex items-center justify-between text-lg font-semibold'>
										<span>{m.home.name}</span>
										<span className='tabular-nums'>
											{m.scores.home} – {m.scores.away}
										</span>
										<span>{m.away.name}</span>
									</div>
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>

			{recent.length > 0 && (
				<section>
					<h2 className='text-xl font-semibold mb-3'>Recent results</h2>
					<ul className='grid sm:grid-cols-2 gap-3'>
						{recent.map((m) => (
							<li key={m.id}>
								<Link
									href={`/m/${m.code}`}
									className='block rounded-lg border border-white/10 bg-white/5 p-4 hover:border-rugby-green'
								>
									<div className='flex items-center justify-between text-xs text-white/60'>
										<span>{m.competition ?? 'Friendly'}</span>
										<span>FT</span>
									</div>
									<div className='mt-2 flex items-center justify-between text-lg font-semibold'>
										<span>{m.home.name}</span>
										<span className='tabular-nums'>
											{m.scores.home} – {m.scores.away}
										</span>
										<span>{m.away.name}</span>
									</div>
								</Link>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}
