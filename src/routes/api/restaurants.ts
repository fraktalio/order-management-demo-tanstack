import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { withDb } from '@/infrastructure/db';
import { handleCommand } from '@/application/index.ts';
import { createRestaurantHandler } from '@/application/command-handlers/createRestaurant.ts';
import { restaurantId } from '@/domain/api.ts';
import type { CreateRestaurantCommand } from '@/domain/api.ts';

export const Route = createFileRoute('/api/restaurants')({
	server: {
		handlers: {
			/** POST /api/restaurants — Create a new restaurant */
			POST: async ({ request }) => {
				const body = (await request.json()) as {
					restaurantId?: string;
					name: string;
					menu: CreateRestaurantCommand['menu'];
				};
				return handleCommand(() =>
					withDb(env, (sql) => {
						const handler = createRestaurantHandler(sql);
						const command: CreateRestaurantCommand = {
							kind: 'CreateRestaurantCommand',
							restaurantId: restaurantId(body.restaurantId ?? crypto.randomUUID()),
							name: body.name,
							menu: body.menu,
						};
						return handler.handle(command);
					}),
				);
			},
		},
	},
});
