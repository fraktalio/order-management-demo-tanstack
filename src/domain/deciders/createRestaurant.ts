import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	type CreateRestaurantCommand,
	RestaurantAlreadyExistsError,
	type RestaurantCreatedEvent,
	type RestaurantId,
} from '../api.ts';

export type CreateRestaurantState = RestaurantId | null;

export const createRestaurantDecider: DcbDecider<
	CreateRestaurantCommand,
	CreateRestaurantState,
	RestaurantCreatedEvent,
	RestaurantCreatedEvent
> = new DcbDecider(
	(command, currentState) => {
		switch (command?.kind) {
			case 'CreateRestaurantCommand':
				if (currentState !== null) {
					throw new RestaurantAlreadyExistsError(command.restaurantId);
				}
				return [
					{
						kind: 'RestaurantCreatedEvent',
						restaurantId: command.restaurantId,
						name: command.name,
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
	null as CreateRestaurantState,
);
