import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	type MarkOrderPaymentFailedCommand,
	type OrderId,
	OrderAlreadyPaidError,
	OrderNotFoundError,
	type OrderPaidEvent,
	type OrderPaymentFailedEvent,
	type RestaurantOrderPlacedEvent,
} from '../api.ts';

type MarkOrderPaymentFailedState = {
	readonly orderId: OrderId | null;
	readonly paid: boolean;
	readonly paymentFailed: boolean;
};

export const markOrderPaymentFailedDecider: DcbDecider<
	MarkOrderPaymentFailedCommand,
	MarkOrderPaymentFailedState,
	RestaurantOrderPlacedEvent | OrderPaidEvent | OrderPaymentFailedEvent,
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
				return { orderId: event.orderId, paid: false, paymentFailed: false };
			case 'OrderPaidEvent':
				return { ...currentState, paid: true };
			case 'OrderPaymentFailedEvent':
				return { ...currentState, paymentFailed: true };
			default:
				return currentState;
		}
	},
	{ orderId: null, paid: false, paymentFailed: false } as MarkOrderPaymentFailedState,
);
