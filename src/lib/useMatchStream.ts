'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicMatch } from '@/lib/matchStore';

export function useMatchStream(id: string) {
	const [match, setMatch] = useState<PublicMatch | null>(null);
	const [error, setError] = useState<string | null>(null);
	const esRef = useRef<EventSource | null>(null);

	useEffect(() => {
		if (!id) return;
		const es = new EventSource(`/api/matches/${id}/stream`);
		esRef.current = es;
		es.onmessage = (e) => {
			try {
				setMatch(JSON.parse(e.data));
			} catch {
				/* ignore */
			}
		};
		es.onerror = () => {
			setError('Connection lost. Retrying…');
		};
		return () => {
			es.close();
			esRef.current = null;
		};
	}, [id]);

	return { match, error };
}
