import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	type MarkOrderPaymentFailedCommand,
	type OrderId,
	OrderAlreadyPaidError,
	OrderAlreadyPreparedError,
	OrderNotFoundError,
	type OrderPaidEvent,
	type OrderPaymentFailedEvent,
	type OrderPreparedEvent,
	type RestaurantOrderPlacedEvent,
} from '../api.ts';

type MarkOrderPaymentFailedState = {
	readonly orderId: OrderId | null;
	readonly paid: boolean;
	readonly paymentFailed: boolean;
	readonly prepared: boolean;
};

export const markOrderPaymentFailedDecider: DcbDecider<
	MarkOrderPaymentFailedCommand,
	MarkOrderPaymentFailedState,
	RestaurantOrderPlacedEvent | OrderPaidEvent | OrderPaymentFailedEvent | OrderPreparedEvent,
	OrderPaymentFailedEvent
> = new DcbDecider(
	(command, currentState) => {
		switch (command?.kind) {
			case 'MarkOrderPaymentFailedCommand': {
				if (currentState.orderId === null) {
					throw new OrderNotFoundError(command.orderId);
				}
				if (currentState.paymentFailed) {
					return []; // Idempotent: duplicate command is a no-op
				}
				if (currentState.prepared) {
					throw new OrderAlreadyPreparedError(command.orderId);
				}
				if (currentState.paid) {
					throw new OrderAlreadyPaidError(command.orderId);
				}
				return [
					{
						kind: 'OrderPaymentFailedEvent',
						orderId: command.orderId,
						reason: command.reason,
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
				return { orderId: event.orderId, paid: false, paymentFailed: false, prepared: false };
			case 'OrderPaidEvent':
				return { ...currentState, paid: true };
			case 'OrderPaymentFailedEvent':
				return { ...currentState, paymentFailed: true };
			case 'OrderPreparedEvent':
				return { ...currentState, prepared: true };
			default:
				return currentState;
		}
	},
	{
		orderId: null,
		paid: false,
		paymentFailed: false,
		prepared: false,
	} as MarkOrderPaymentFailedState,
);
