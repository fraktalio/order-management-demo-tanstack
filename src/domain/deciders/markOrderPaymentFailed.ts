import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	type MarkOrderPaymentFailedCommand,
	OrderAlreadyPaidError,
	OrderNotFoundError,
	type OrderPaidEvent,
	type OrderPaymentFailedEvent,
	type PaymentInitiatedEvent,
	PaymentNotInitiatedError,
	type RestaurantOrderPlacedEvent,
} from '../api.ts';

type MarkOrderPaymentFailedStatus =
	| 'NOT_FOUND'
	| 'PLACED'
	| 'PAYMENT_INITIATED'
	| 'PAID'
	| 'PAYMENT_FAILED';

type MarkOrderPaymentFailedState = {
	readonly status: MarkOrderPaymentFailedStatus;
};

export const markOrderPaymentFailedDecider: DcbDecider<
	MarkOrderPaymentFailedCommand,
	MarkOrderPaymentFailedState,
	RestaurantOrderPlacedEvent | PaymentInitiatedEvent | OrderPaidEvent | OrderPaymentFailedEvent,
	OrderPaymentFailedEvent
> = new DcbDecider(
	(command, currentState) => {
		switch (command?.kind) {
			case 'MarkOrderPaymentFailedCommand': {
				switch (currentState.status) {
					case 'NOT_FOUND':
						throw new OrderNotFoundError(command.orderId);
					case 'PLACED':
						throw new PaymentNotInitiatedError(command.orderId);
					case 'PAYMENT_INITIATED':
						return [
							{
								kind: 'OrderPaymentFailedEvent',
								orderId: command.orderId,
								reason: command.reason,
								final: false,
								tagFields: ['orderId'],
							},
						];
					case 'PAID':
						throw new OrderAlreadyPaidError(command.orderId);
					case 'PAYMENT_FAILED':
						return []; // Idempotent: duplicate command is a no-op
					default: {
						const _exhaustiveCheck: never = currentState.status;
						throw new Error(`Unexpected status: ${_exhaustiveCheck}`);
					}
				}
			}
			default:
				return [];
		}
	},
	(currentState, event) => {
		switch (event?.kind) {
			case 'RestaurantOrderPlacedEvent':
				return { status: 'PLACED' };
			case 'PaymentInitiatedEvent':
				return { status: 'PAYMENT_INITIATED' };
			case 'OrderPaidEvent':
				return { status: 'PAID' };
			case 'OrderPaymentFailedEvent':
				return { status: 'PAYMENT_FAILED' };
			default:
				return currentState;
		}
	},
	{ status: 'NOT_FOUND' } as MarkOrderPaymentFailedState,
);
