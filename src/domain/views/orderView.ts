import { Projection } from '@fraktalio/fmodel-decider';
import type {
	MenuItem,
	OrderId,
	OrderPreparedEvent,
	OrderStatus,
	RestaurantId,
	RestaurantOrderPlacedEvent,
} from '../api.ts';

type OrderEvent = RestaurantOrderPlacedEvent | OrderPreparedEvent;

export type OrderViewState = {
	readonly orderId: OrderId;
	readonly restaurantId: RestaurantId;
	readonly menuItems: MenuItem[];
	readonly status: OrderStatus;
};

export const orderView: Projection<OrderViewState | null, OrderEvent> = new Projection(
	(currentState, event) => {
		switch (event.kind) {
			case 'RestaurantOrderPlacedEvent':
				return {
					orderId: event.orderId,
					restaurantId: event.restaurantId,
					menuItems: event.menuItems,
					status: 'CREATED',
				};
			case 'OrderPreparedEvent':
				return currentState !== null
					? {
							orderId: currentState.orderId,
							restaurantId: currentState.restaurantId,
							menuItems: currentState.menuItems,
							status: 'PREPARED',
						}
					: currentState;
			default: {
				// @ts-expect-error exhaustive check
				const _exhaustiveCheck: never = event;
				return currentState;
			}
		}
	},
	null as OrderViewState | null,
);
