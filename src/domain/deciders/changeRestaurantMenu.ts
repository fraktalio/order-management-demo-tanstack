import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	type ChangeRestaurantMenuCommand,
	type RestaurantCreatedEvent,
	type RestaurantId,
	type RestaurantMenuChangedEvent,
	RestaurantNotFoundError,
} from '../api.ts';

type ChangeRestaurantMenuState = RestaurantId | null;

export const changeRestaurantMenuDecider: DcbDecider<
	ChangeRestaurantMenuCommand,
	ChangeRestaurantMenuState,
	RestaurantCreatedEvent,
	RestaurantMenuChangedEvent
> = new DcbDecider(
	(command, currentState) => {
		switch (command?.kind) {
			case 'ChangeRestaurantMenuCommand':
				if (currentState === null) {
					throw new RestaurantNotFoundError(command.restaurantId);
				}
				return [
					{
						kind: 'RestaurantMenuChangedEvent',
						restaurantId: command.restaurantId,
						menu: command.menu,
						final: false,
						tagFields: ['restaurantId'],
					},
				];
			default:
				return [];
		}
	},
	(currentState, event) => {
		switch (event?.kind) {
			case 'RestaurantCreatedEvent':
				return event.restaurantId;
			default:
				return currentState;
		}
	},
	null as ChangeRestaurantMenuState,
);
