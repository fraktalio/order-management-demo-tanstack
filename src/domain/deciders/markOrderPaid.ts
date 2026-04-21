import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	type MarkOrderPaidCommand,
	OrderNotFoundError,
	type OrderPaidEvent,
	type OrderPaymentFailedEvent,
	type OrderPreparedEvent,
	type PaymentInitiatedEvent,
	PaymentNotInitiatedError,
	type RestaurantOrderPlacedEvent,
} from '../api.ts';

type MarkOrderPaidStatus =
	| 'NOT_FOUND'
	| 'PLACED'
	| 'PAYMENT_INITIATED'
	| 'PAID'
	| 'PAYMENT_FAILED'
	| 'PREPARED';

type MarkOrderPaidState = {
	readonly status: MarkOrderPaidStatus;
};

export const markOrderPaidDecider: DcbDecider<
	MarkOrderPaidCommand,
	MarkOrderPaidState,
	| RestaurantOrderPlacedEvent
	| PaymentInitiatedEvent
	| OrderPaidEvent
	| OrderPaymentFailedEvent
	| OrderPreparedEvent,
	OrderPaidEvent
> = new DcbDecider(
	(command, currentState) => {
		switch (command?.kind) {
			case 'MarkOrderPaidCommand': {
				switch (currentState.status) {
					case 'NOT_FOUND':
						throw new OrderNotFoundError(command.orderId);
					case 'PLACED':
						throw new PaymentNotInitiatedError(command.orderId);
					case 'PAYMENT_INITIATED':
					case 'PAYMENT_FAILED':
						return [
							{
								kind: 'OrderPaidEvent',
								orderId: command.orderId,
								final: false,
								tagFields: ['orderId'],
							},
						];
					case 'PAID':
						return []; // Idempotent: duplicate command is a no-op
					case 'PREPARED':
						return []; // Already paid and prepared — still idempotent
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
			case 'OrderPreparedEvent':
				return { status: 'PREPARED' };
			default:
				return currentState;
		}
	},
	{ status: 'NOT_FOUND' } as MarkOrderPaidState,
);
