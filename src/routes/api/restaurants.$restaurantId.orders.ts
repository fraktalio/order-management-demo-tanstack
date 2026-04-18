import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { withDb } from '@/infrastructure/db';
import { handleCommand } from '@/application/index.ts';
import { placeOrderHandler } from '@/application/command-handlers/placeOrder.ts';
import { restaurantId, orderId } from '@/domain/api.ts';
import type { PlaceOrderCommand } from '@/domain/api.ts';

export const Route = createFileRoute('/api/restaurants/$restaurantId/orders')({
	server: {
		handlers: {
			/** POST /api/restaurants/:restaurantId/orders — Place an order */
			POST: async ({ request, params }) => {
				const body = (await request.json()) as {
					orderId?: string;
					menuItems: PlaceOrderCommand['menuItems'];
				};
				return handleCommand(() =>
					withDb(env, (sql) => {
						const handler = placeOrderHandler(sql);
						const command: PlaceOrderCommand = {
							kind: 'PlaceOrderCommand',
							restaurantId: restaurantId(params.restaurantId),
							orderId: orderId(body.orderId ?? crypto.randomUUID()),
							menuItems: body.menuItems,
						};
						return handler.handle(command);
					}),
				);
			},
		},
	},
});
