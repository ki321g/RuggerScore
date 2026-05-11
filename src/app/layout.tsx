import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { RegisterSW } from '@/components/RegisterSW';
import { AuthProvider } from '@/components/AuthProvider';
import { HeaderAuth } from '@/components/HeaderAuth';
import './globals.css';

export const metadata: Metadata = {
	title: 'RugbyScore — Live grassroots rugby scores',
	description:
		'Score a match, share a link, follow live. The PWA-first rugby scoring platform for clubs, coaches, parents and fans.',
	manifest: '/manifest.webmanifest',
	applicationName: 'RugbyScore',
	appleWebApp: {
		capable: true,
		title: 'RugbyScore',
		statusBarStyle: 'black-translucent',
	},
};

export const viewport: Viewport = {
	themeColor: '#0a6b3a',
	width: 'device-width',
	initialScale: 1,
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang='en'>
			<body className='min-h-screen flex flex-col'>
				<AuthProvider>
					<header className='border-b border-white/10 bg-rugby-dark/80 backdrop-blur sticky top-0 z-10'>
						<div className='mx-auto max-w-5xl px-4 py-3 flex items-center justify-between'>
							<Link href='/' className='font-bold text-lg tracking-tight'>
								<span className='text-rugby-green'>Rugby</span>Score
							</Link>
							<nav className='flex gap-4 text-sm items-center'>
								<Link href='/' className='hover:text-rugby-green'>
									Discover
								</Link>
								<Link href='/score/new' className='hover:text-rugby-green'>
									Score a match
								</Link>
								<Link href='/club-admin' className='hover:text-rugby-green'>
									Clubs
								</Link>
								<HeaderAuth />
							</nav>
						</div>
					</header>
					<main className='flex-1 mx-auto w-full max-w-5xl px-4 py-6'>
						{children}
					</main>
					<footer className='border-t border-white/10 text-xs text-white/50 py-4 text-center'>
						RugbyScore · PWA-first grassroots rugby · MVP
					</footer>
					<RegisterSW />
				</AuthProvider>
			</body>
		</html>
	);
}
