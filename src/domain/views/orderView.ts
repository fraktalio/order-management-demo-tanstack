import { Projection } from '@fraktalio/fmodel-decider';
import type {
	MenuItem,
	OrderId,
	OrderPaidEvent,
	OrderPaymentFailedEvent,
	OrderPreparedEvent,
	OrderStatus,
	PaymentInitiatedEvent,
	PaymentExemptedEvent,
	RestaurantId,
	RestaurantOrderPlacedEvent,
} from '../api.ts';

export type OrderEvent =
	| RestaurantOrderPlacedEvent
	| PaymentInitiatedEvent
	| PaymentExemptedEvent
	| OrderPaidEvent
	| OrderPaymentFailedEvent
	| OrderPreparedEvent;

export type OrderViewState = {
	readonly orderId: OrderId;
	readonly restaurantId: RestaurantId;
	readonly menuItems: MenuItem[];
	readonly status: OrderStatus;
};

export const orderView: Projection<OrderViewState | null, OrderEvent> = new Projection(
	(currentState, event) => {
		switch (event.kind) {
			case 'RestaurantOrderPlacedEvent':
				return {
					orderId: event.orderId,
					restaurantId: event.restaurantId,
					menuItems: event.menuItems,
					status: 'CREATED',
				};
			case 'PaymentInitiatedEvent':
				return currentState; // Status stays CREATED — payment is just initiated
			case 'PaymentExemptedEvent':
				return currentState !== null ? { ...currentState, status: 'PAID' } : currentState;
			case 'OrderPaidEvent':
				return currentState !== null ? { ...currentState, status: 'PAID' } : currentState;
			case 'OrderPaymentFailedEvent':
				return currentState !== null ? { ...currentState, status: 'PAYMENT_FAILED' } : currentState;
			case 'OrderPreparedEvent':
				return currentState !== null ? { ...currentState, status: 'PREPARED' } : currentState;
			default: {
				// @ts-expect-error exhaustive check
				const _exhaustiveCheck: never = event;
				return currentState;
			}
		}
	},
	null as OrderViewState | null,
);
