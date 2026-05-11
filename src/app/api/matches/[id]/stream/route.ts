import { store, publicMatch } from '@/lib/matchStore';

export const dynamic = 'force-dynamic';
// Keep this handler on the Node runtime — `pg` does not work on Edge.
export const runtime = 'nodejs';
// Allow long-lived SSE connections (Vercel: 60s on Hobby, up to 300s on Pro).
export const maxDuration = 300;

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	await store.ready;
	const initial = (await store.reload(id)) ?? store.getByCode(id);
	if (!initial) return new Response('Match not found', { status: 404 });
	const matchId = initial.id;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			const send = (data: unknown) => {
				try {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
					);
				} catch {
					/* closed */
				}
			};

			// initial snapshot
			let lastUpdatedAt = initial.updatedAt;
			let lastEventCount = initial.events.length;
			send(publicMatch(initial));

			// Same-instance fast path: emit on every local mutation.
			const unsub = store.subscribe(matchId, (updated) => {
				lastUpdatedAt = updated.updatedAt;
				lastEventCount = updated.events.length;
				send(publicMatch(updated));
			});

			// Cross-instance fallback: poll the DB. On Vercel the scorer's POST
			// may land on a different Lambda instance than this SSE connection,
			// so in-memory pub/sub alone is not enough.
			const poll = setInterval(async () => {
				try {
					const fresh = await store.reload(matchId);
					if (!fresh) return;
					if (
						fresh.updatedAt !== lastUpdatedAt ||
						fresh.events.length !== lastEventCount
					) {
						lastUpdatedAt = fresh.updatedAt;
						lastEventCount = fresh.events.length;
						send(publicMatch(fresh));
					}
				} catch {
					/* swallow poll errors so the stream stays alive */
				}
			}, 1500);

			// keepalive ping every 25s
			const ping = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': ping\n\n'));
				} catch {
					/* closed */
				}
			}, 25000);

			const close = () => {
				clearInterval(ping);
				clearInterval(poll);
				unsub();
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			};
			// @ts-expect-error - non-standard but used to cleanup
			controller._close = close;
		},
		cancel() {
			// controller cleanup handled in start via abort-like flow
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no',
		},
	});
}
