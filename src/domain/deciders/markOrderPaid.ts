import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	type MarkOrderPaidCommand,
	type OrderId,
	OrderAlreadyPreparedError,
	OrderNotFoundError,
	type OrderPaidEvent,
	type OrderPreparedEvent,
	type RestaurantOrderPlacedEvent,
} from '../api.ts';

type MarkOrderPaidState = {
	readonly orderId: OrderId | null;
	readonly paid: boolean;
	readonly prepared: boolean;
};

export const markOrderPaidDecider: DcbDecider<
	MarkOrderPaidCommand,
	MarkOrderPaidState,
	RestaurantOrderPlacedEvent | OrderPaidEvent | OrderPreparedEvent,
	OrderPaidEvent
> = new DcbDecider(
	(command, currentState) => {
		switch (command?.kind) {
			case 'MarkOrderPaidCommand': {
				if (currentState.orderId === null) {
					throw new OrderNotFoundError(command.orderId);
				}
				if (currentState.paid) {
					return []; // Idempotent: duplicate command is a no-op
				}
				if (currentState.prepared) {
					throw new OrderAlreadyPreparedError(command.orderId);
				}
				return [
					{
						kind: 'OrderPaidEvent',
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
				return { orderId: event.orderId, paid: false, prepared: false };
			case 'OrderPaidEvent':
				return { ...currentState, paid: true };
			case 'OrderPreparedEvent':
				return { ...currentState, prepared: true };
			default:
				return currentState;
		}
	},
	{ orderId: null, paid: false, prepared: false } as MarkOrderPaidState,
);
