import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	type MarkOrderPaymentFailedCommand,
	type OrderId,
	OrderNotFoundError,
	OrderPaymentAlreadyFailedError,
	type OrderPaymentFailedEvent,
	type RestaurantOrderPlacedEvent,
} from '../api.ts';

type MarkOrderPaymentFailedState = {
	readonly orderId: OrderId | null;
	readonly paymentFailed: boolean;
};

export const markOrderPaymentFailedDecider: DcbDecider<
	MarkOrderPaymentFailedCommand,
	MarkOrderPaymentFailedState,
	RestaurantOrderPlacedEvent | OrderPaymentFailedEvent,
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
				return { orderId: event.orderId, paymentFailed: false };
			case 'OrderPaymentFailedEvent':
				return { ...currentState, paymentFailed: true };
			default:
				return currentState;
		}
	},
	{ orderId: null, paymentFailed: false } as MarkOrderPaymentFailedState,
);
