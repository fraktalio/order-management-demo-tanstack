import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	MenuItemsNotAvailableError,
	type PlaceOrderCommand,
	type RestaurantCreatedEvent,
	type RestaurantId,
	type RestaurantMenu,
	type RestaurantMenuChangedEvent,
	RestaurantNotFoundError,
	type RestaurantOrderPlacedEvent,
} from '../api.ts';

type PlaceOrderState = {
	readonly restaurantId: RestaurantId | null;
	readonly menu: RestaurantMenu | null;
	readonly orderPlaced: boolean;
};

export const placeOrderDecider: DcbDecider<
	PlaceOrderCommand,
	PlaceOrderState,
	RestaurantCreatedEvent | RestaurantMenuChangedEvent | RestaurantOrderPlacedEvent,
	RestaurantOrderPlacedEvent
> = new DcbDecider(
	(command, currentState) => {
		switch (command?.kind) {
			case 'PlaceOrderCommand': {
				if (currentState.restaurantId === null) {
					throw new RestaurantNotFoundError(command.restaurantId);
				}
				if (currentState.orderPlaced) {
					return []; // Idempotent: duplicate command is a no-op
				}
				if (currentState.menu === null) {
					throw new RestaurantNotFoundError(command.restaurantId);
				}
				const menuItemIds = new Set(currentState.menu.menuItems.map((item) => item.menuItemId));
				const unavailableItems = command.menuItems
					.filter((item) => !menuItemIds.has(item.menuItemId))
					.map((item) => item.menuItemId);
				if (unavailableItems.length > 0) {
					throw new MenuItemsNotAvailableError(unavailableItems);
				}
				return [
					{
						kind: 'RestaurantOrderPlacedEvent',
						restaurantId: command.restaurantId,
						orderId: command.orderId,
						menuItems: command.menuItems,
						final: false,
						tagFields: ['restaurantId', 'orderId'],
					},
				];
			}
			default:
				return [];
		}
	},
	(currentState, event) => {
		switch (event?.kind) {
			case 'RestaurantCreatedEvent':
				return { restaurantId: event.restaurantId, menu: event.menu, orderPlaced: false };
			case 'RestaurantMenuChangedEvent':
				return { ...currentState, menu: event.menu };
			case 'RestaurantOrderPlacedEvent':
				return { ...currentState, orderPlaced: true };
			default:
				return currentState;
		}
	},
	{ restaurantId: null, menu: null, orderPlaced: false } as PlaceOrderState,
);
