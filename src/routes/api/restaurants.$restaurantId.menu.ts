import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { withDb } from '@/infrastructure/db';
import { handleCommand } from '@/application/index.ts';
import { changeRestaurantMenuHandler } from '@/application/command-handlers/changeRestaurantMenu.ts';
import { restaurantId } from '@/domain/api.ts';
import type { ChangeRestaurantMenuCommand } from '@/domain/api.ts';

export const Route = createFileRoute('/api/restaurants/$restaurantId/menu')({
	server: {
		handlers: {
			/** PUT /api/restaurants/:restaurantId/menu — Change restaurant menu */
			PUT: async ({ request, params }) => {
				const body = (await request.json()) as {
					menu: ChangeRestaurantMenuCommand['menu'];
				};
				return handleCommand(() =>
					withDb(env, (sql) => {
						const handler = changeRestaurantMenuHandler(sql);
						const command: ChangeRestaurantMenuCommand = {
							kind: 'ChangeRestaurantMenuCommand',
							restaurantId: restaurantId(params.restaurantId),
							menu: body.menu,
						};
						return handler.handle(command);
					}),
				);
			},
		},
	},
});
