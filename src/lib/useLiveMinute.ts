'use client';

import { useEffect, useState } from 'react';
import type { PublicMatch } from '@/lib/matchStore';

/**
 * Returns a live-ticking minute for the match. When the clock is running
 * (status=live with halfStartedAt set), updates every second based on the
 * client clock, adjusted for client/server skew using `serverNow`.
 */
export function useLiveMinute(match: PublicMatch | null): number {
	const [, force] = useState(0);

	useEffect(() => {
		if (!match) return;
		if (match.clockRunningSince == null) return;
		const tick = () => force((n) => n + 1);
		const i = setInterval(tick, 1000);
		return () => clearInterval(i);
	}, [match?.clockRunningSince, match?.id]);

	if (!match) return 0;
	if (match.clockRunningSince == null) return match.minute;
	const skew = Date.now() - match.serverNow;
	const serverNow = Date.now() - skew;
	const elapsed = match.clockBaseMs + (serverNow - match.clockRunningSince);
	return Math.max(0, Math.floor(elapsed / 60000));
}
