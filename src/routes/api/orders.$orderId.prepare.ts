import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { withDb } from '@/infrastructure/db';
import { handleCommand } from '@/application/index.ts';
import { markOrderAsPreparedHandler } from '@/application/command-handlers/markOrderAsPrepared.ts';
import { orderId } from '@/domain/api.ts';
import type { MarkOrderAsPreparedCommand } from '@/domain/api.ts';

export const Route = createFileRoute('/api/orders/$orderId/prepare')({
	server: {
		handlers: {
			/** POST /api/orders/:orderId/prepare — Mark order as prepared */
			POST: async ({ params }) => {
				return handleCommand(() =>
					withDb(env, (sql) => {
						const handler = markOrderAsPreparedHandler(sql);
						const command: MarkOrderAsPreparedCommand = {
							kind: 'MarkOrderAsPreparedCommand',
							orderId: orderId(params.orderId),
						};
						return handler.handle(command);
					}),
				);
			},
		},
	},
});
