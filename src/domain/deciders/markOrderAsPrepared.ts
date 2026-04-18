import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	type MarkOrderAsPreparedCommand,
	OrderAlreadyPreparedError,
	type OrderId,
	OrderNotFoundError,
	type OrderPreparedEvent,
	type RestaurantOrderPlacedEvent,
} from '../api.ts';

type MarkOrderAsPreparedState = {
	readonly orderId: OrderId | null;
	readonly prepared: boolean;
};

export const markOrderAsPreparedDecider: DcbDecider<
	MarkOrderAsPreparedCommand,
	MarkOrderAsPreparedState,
	RestaurantOrderPlacedEvent | OrderPreparedEvent,
	OrderPreparedEvent
> = new DcbDecider(
	(command, currentState) => {
		switch (command?.kind) {
			case 'MarkOrderAsPreparedCommand': {
				if (currentState.orderId === null) {
					throw new OrderNotFoundError(command.orderId);
				}
				if (currentState.prepared) {
					throw new OrderAlreadyPreparedError(command.orderId);
				}
				return [
					{
						kind: 'OrderPreparedEvent',
						orderId: command.orderId,
						final: false,
						tagFields: ['orderId'],
					},
				];
			}
			default:
				return [];
		}
	},
	(currentState, event) => {
		switch (event?.kind) {
			case 'RestaurantOrderPlacedEvent':
				return { orderId: event.orderId, prepared: false };
			case 'OrderPreparedEvent':
				return { ...currentState, prepared: true };
			default:
				return currentState;
		}
	},
	{ orderId: null, prepared: false } as MarkOrderAsPreparedState,
);
