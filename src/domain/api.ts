/**
 * Restaurant management domain model — Commands, Events, branded types, and domain errors.
 * Based on the fmodel-decider DCB (Dynamic Consistency Boundary) pattern.
 */

import type { TypeSafeEventShape } from '@fraktalio/fmodel-decider';

// ─── Branded Types ──────────────────────────────────────────────────

type Brand<T, B> = T & { readonly __brand: B };

export type RestaurantId = Brand<string, 'RestaurantId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type MenuItemId = Brand<string, 'MenuItemId'>;
export type RestaurantMenuId = Brand<string, 'RestaurantMenuId'>;

export const restaurantId = (id: string): RestaurantId => id as RestaurantId;
export const orderId = (id: string): OrderId => id as OrderId;
export const menuItemId = (id: string): MenuItemId => id as MenuItemId;
export const restaurantMenuId = (id: string): RestaurantMenuId => id as RestaurantMenuId;

// ─── Domain Errors ──────────────────────────────────────────────────

export class DomainError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class RestaurantAlreadyExistsError extends DomainError {
	constructor(public readonly restaurantId: RestaurantId) {
		super(`Restaurant ${restaurantId} already exists`);
	}
}

export class RestaurantNotFoundError extends DomainError {
	constructor(public readonly restaurantId: RestaurantId) {
		super(`Restaurant ${restaurantId} does not exist`);
	}
}

export class OrderAlreadyExistsError extends DomainError {
	constructor(public readonly orderId: OrderId) {
		super(`Order ${orderId} already exists`);
	}
}

export class OrderNotFoundError extends DomainError {
	constructor(public readonly orderId: OrderId) {
		super(`Order ${orderId} does not exist`);
	}
}

export class OrderAlreadyPreparedError extends DomainError {
	constructor(public readonly orderId: OrderId) {
		super(`Order ${orderId} is already prepared`);
	}
}

export class OrderAlreadyPaidError extends DomainError {
	constructor(public readonly orderId: OrderId) {
		super(`Order ${orderId} is already paid`);
	}
}

export class OrderNotPaidError extends DomainError {
	constructor(public readonly orderId: OrderId) {
		super(`Order ${orderId} has not been paid`);
	}
}

export class OrderPaymentAlreadyFailedError extends DomainError {
	constructor(public readonly orderId: OrderId) {
		super(`Order ${orderId} payment has already failed`);
	}
}

export class PaymentNotInitiatedError extends DomainError {
	constructor(public readonly orderId: OrderId) {
		super(`Payment was not initiated for order ${orderId}`);
	}
}

export class MenuItemsNotAvailableError extends DomainError {
	constructor(public readonly menuItemIds: readonly MenuItemId[]) {
		super(`Menu items not available: ${menuItemIds.join(', ')}`);
	}
}

// ─── Value Objects ──────────────────────────────────────────────────

export type RestaurantName = string;
export type MenuItemName = string;
export type MenuItemPrice = string;
export type OrderStatus = 'NOT_CREATED' | 'CREATED' | 'PAID' | 'PAYMENT_FAILED' | 'PREPARED';

export type RestaurantMenuCuisine =
	| 'GENERAL'
	| 'SERBIAN'
	| 'ITALIAN'
	| 'MEXICAN'
	| 'CHINESE'
	| 'INDIAN'
	| 'FRENCH';

export type MenuItem = {
	readonly menuItemId: MenuItemId;
	readonly name: MenuItemName;
	readonly price: MenuItemPrice;
};

export type RestaurantMenu = {
	readonly menuItems: MenuItem[];
	readonly menuId: RestaurantMenuId;
	readonly cuisine: RestaurantMenuCuisine;
};

// ─── Commands ───────────────────────────────────────────────────────

export type Command =
	| CreateRestaurantCommand
	| ChangeRestaurantMenuCommand
	| PlaceOrderCommand
	| MarkOrderPaidCommand
	| MarkOrderPaymentFailedCommand
	| MarkOrderAsPreparedCommand;

export type CreateRestaurantCommand = {
	readonly kind: 'CreateRestaurantCommand';
	readonly restaurantId: RestaurantId;
	readonly name: RestaurantName;
	readonly menu: RestaurantMenu;
};

export type ChangeRestaurantMenuCommand = {
	readonly kind: 'ChangeRestaurantMenuCommand';
	readonly restaurantId: RestaurantId;
	readonly menu: RestaurantMenu;
};

export type PlaceOrderCommand = {
	readonly kind: 'PlaceOrderCommand';
	readonly restaurantId: RestaurantId;
	readonly orderId: OrderId;
	readonly menuItems: MenuItem[];
};

export type MarkOrderPaidCommand = {
	readonly kind: 'MarkOrderPaidCommand';
	readonly orderId: OrderId;
};

export type MarkOrderPaymentFailedCommand = {
	readonly kind: 'MarkOrderPaymentFailedCommand';
	readonly orderId: OrderId;
	readonly reason: string;
};

export type MarkOrderAsPreparedCommand = {
	readonly kind: 'MarkOrderAsPreparedCommand';
	readonly orderId: OrderId;
};

// ─── Events ─────────────────────────────────────────────────────────

export type Event =
	| RestaurantCreatedEvent
	| RestaurantMenuChangedEvent
	| RestaurantOrderPlacedEvent
	| PaymentInitiatedEvent
	| PaymentExemptedEvent
	| OrderPaidEvent
	| OrderPaymentFailedEvent
	| OrderPreparedEvent;

export type RestaurantCreatedEvent = TypeSafeEventShape<
	{
		readonly kind: 'RestaurantCreatedEvent';
		readonly restaurantId: RestaurantId;
		readonly name: RestaurantName;
		readonly menu: RestaurantMenu;
		readonly final: boolean;
	},
	['restaurantId']
>;

export type RestaurantMenuChangedEvent = TypeSafeEventShape<
	{
		readonly kind: 'RestaurantMenuChangedEvent';
		readonly restaurantId: RestaurantId;
		readonly menu: RestaurantMenu;
		readonly final: boolean;
	},
	['restaurantId']
>;

export type RestaurantOrderPlacedEvent = TypeSafeEventShape<
	{
		readonly kind: 'RestaurantOrderPlacedEvent';
		readonly restaurantId: RestaurantId;
		readonly orderId: OrderId;
		readonly menuItems: MenuItem[];
		readonly final: boolean;
	},
	['restaurantId', 'orderId']
>;

export type PaymentInitiatedEvent = TypeSafeEventShape<
	{
		readonly kind: 'PaymentInitiatedEvent';
		readonly orderId: OrderId;
		readonly amount: string;
		readonly final: boolean;
	},
	['orderId']
>;

export type PaymentExemptedEvent = TypeSafeEventShape<
	{
		readonly kind: 'PaymentExemptedEvent';
		readonly orderId: OrderId;
		readonly reason: string;
		readonly final: boolean;
	},
	['orderId']
>;

export type OrderPaidEvent = TypeSafeEventShape<
	{
		readonly kind: 'OrderPaidEvent';
		readonly orderId: OrderId;
		readonly final: boolean;
	},
	['orderId']
>;

export type OrderPaymentFailedEvent = TypeSafeEventShape<
	{
		readonly kind: 'OrderPaymentFailedEvent';
		readonly orderId: OrderId;
		readonly reason: string;
		readonly final: boolean;
	},
	['orderId']
>;

export type OrderPreparedEvent = TypeSafeEventShape<
	{
		readonly kind: 'OrderPreparedEvent';
		readonly orderId: OrderId;
		readonly final: boolean;
	},
	['orderId']
>;
