import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	type MarkOrderAsPreparedCommand,
	OrderNotFoundError,
	OrderNotPaidError,
	type OrderPaidEvent,
	type OrderPreparedEvent,
	type PaymentExemptedEvent,
	type RestaurantOrderPlacedEvent,
} from '../api.ts';

type MarkOrderAsPreparedStatus = 'NOT_FOUND' | 'PLACED' | 'PAYMENT_EXEMPTED' | 'PAID' | 'PREPARED';

type MarkOrderAsPreparedState = {
	readonly status: MarkOrderAsPreparedStatus;
};

export const markOrderAsPreparedDecider: DcbDecider<
	MarkOrderAsPreparedCommand,
	MarkOrderAsPreparedState,
	RestaurantOrderPlacedEvent | PaymentExemptedEvent | OrderPaidEvent | OrderPreparedEvent,
	OrderPreparedEvent
> = new DcbDecider(
	(command, currentState) => {
		switch (command?.kind) {
			case 'MarkOrderAsPreparedCommand': {
				switch (currentState.status) {
					case 'NOT_FOUND':
						throw new OrderNotFoundError(command.orderId);
					case 'PLACED':
						throw new OrderNotPaidError(command.orderId);
					case 'PAID':
					case 'PAYMENT_EXEMPTED':
						return [
							{
								kind: 'OrderPreparedEvent',
								orderId: command.orderId,
								final: false,
								tagFields: ['orderId'],
							},
						];
					case 'PREPARED':
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
			case 'PaymentExemptedEvent':
				return { status: 'PAYMENT_EXEMPTED' };
			case 'OrderPaidEvent':
				return { status: 'PAID' };
			case 'OrderPreparedEvent':
				return { status: 'PREPARED' };
			default:
				return currentState;
		}
	},
	{ status: 'NOT_FOUND' } as MarkOrderAsPreparedState,
);
