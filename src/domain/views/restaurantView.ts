import { Projection } from '@fraktalio/fmodel-decider';
import type {
	RestaurantCreatedEvent,
	RestaurantId,
	RestaurantMenu,
	RestaurantMenuChangedEvent,
	RestaurantName,
} from '../api.ts';

export type RestaurantEvent = RestaurantCreatedEvent | RestaurantMenuChangedEvent;

export type RestaurantViewState = {
	readonly restaurantId: RestaurantId;
	readonly name: RestaurantName;
	readonly menu: RestaurantMenu;
};

export const restaurantView: Projection<RestaurantViewState | null, RestaurantEvent> =
	new Projection(
		(currentState, event) => {
			switch (event.kind) {
				case 'RestaurantCreatedEvent':
					return { restaurantId: event.restaurantId, name: event.name, menu: event.menu };
				case 'RestaurantMenuChangedEvent':
					return currentState !== null
						? { restaurantId: currentState.restaurantId, name: currentState.name, menu: event.menu }
						: currentState;
				default: {
					// @ts-expect-error exhaustive check
					const _exhaustiveCheck: never = event;
					return currentState;
				}
			}
		},
		null as RestaurantViewState | null,
	);
