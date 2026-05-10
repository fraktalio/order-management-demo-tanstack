import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { withDb } from '@/infrastructure/db';
import { handleCommand } from '@/application/index.ts';
import { markOrderAsPreparedHandler } from '@/application/command-handlers/markOrderAsPrepared.ts';
import { orderId } from '@/domain/api.ts';

export const Route = createFileRoute('/api/orders/$orderId/prepare')({
	server: {
		handlers: {
			/** POST /api/orders/:orderId/prepare — Mark order as prepared */
			POST: async ({ request, params }) => {
				const body = (await request.json().catch(() => ({}))) as {
					idempotencyKey?: string;
				};
				return handleCommand(() =>
					withDb(env, (sql) => {
						const handler = markOrderAsPreparedHandler(sql);
						return handler.handle({
							kind: 'MarkOrderAsPreparedCommand',
							orderId: orderId(params.orderId),
							idempotencyKey: body.idempotencyKey ?? crypto.randomUUID(),
						});
					}),
				);
			},
		},
	},
});
