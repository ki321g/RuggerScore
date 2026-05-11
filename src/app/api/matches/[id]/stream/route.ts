import { store, publicMatch } from '@/lib/matchStore';

export const dynamic = 'force-dynamic';

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	await store.ready;
	const m = store.get(id) ?? store.getByCode(id);
	if (!m) return new Response('Match not found', { status: 404 });
	const matchId = m.id;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			const send = (data: unknown) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
			};

			// initial snapshot
			send(publicMatch(m));

			const unsub = store.subscribe(matchId, (updated) => {
				send(publicMatch(updated));
			});

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
