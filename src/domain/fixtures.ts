import {
	type RestaurantCreatedEvent,
	type RestaurantMenuChangedEvent,
	type RestaurantOrderPlacedEvent,
	type PaymentInitiatedEvent,
	type OrderPaidEvent,
	type OrderPaymentFailedEvent,
	type OrderPreparedEvent,
	restaurantId,
	orderId,
	menuItemId,
	restaurantMenuId,
} from './api.ts';

export const rId = restaurantId('r1');
export const oId = orderId('o1');
export const mId = menuItemId('m1');
export const rmId = restaurantMenuId('rm1');

export const menu = {
	menuId: rmId,
	cuisine: 'SERBIAN' as const,
	menuItems: [{ menuItemId: mId, name: 'Ćevapi', price: '12.00' }],
};

export const newMenu = {
	menuId: restaurantMenuId('rm2'),
	cuisine: 'ITALIAN' as const,
	menuItems: [{ menuItemId: menuItemId('m2'), name: 'Pizza', price: '15.00' }],
};

export const freeMenu = {
	menuId: restaurantMenuId('rm3'),
	cuisine: 'GENERAL' as const,
	menuItems: [{ menuItemId: menuItemId('m3'), name: 'Free Sample', price: '0.00' }],
};

export const restaurantCreated: RestaurantCreatedEvent = {
	kind: 'RestaurantCreatedEvent',
	restaurantId: rId,
	name: 'Test Restaurant',
	menu,
	final: false,
	tagFields: ['restaurantId'],
};

export const menuChanged: RestaurantMenuChangedEvent = {
	kind: 'RestaurantMenuChangedEvent',
	restaurantId: rId,
	menu: newMenu,
	final: false,
	tagFields: ['restaurantId'],
};

export const orderPlaced: RestaurantOrderPlacedEvent = {
	kind: 'RestaurantOrderPlacedEvent',
	restaurantId: rId,
	orderId: oId,
	menuItems: menu.menuItems,
	final: false,
	tagFields: ['restaurantId', 'orderId'],
};

export const paymentInitiated: PaymentInitiatedEvent = {
	kind: 'PaymentInitiatedEvent',
	orderId: oId,
	amount: '12.00',
	final: false,
	tagFields: ['orderId'],
};

export const freeRestaurantCreated: RestaurantCreatedEvent = {
	kind: 'RestaurantCreatedEvent',
	restaurantId: rId,
	name: 'Free Restaurant',
	menu: freeMenu,
	final: false,
	tagFields: ['restaurantId'],
};

export const freeOrderPlaced: RestaurantOrderPlacedEvent = {
	kind: 'RestaurantOrderPlacedEvent',
	restaurantId: rId,
	orderId: oId,
	menuItems: freeMenu.menuItems,
	final: false,
	tagFields: ['restaurantId', 'orderId'],
};

export const orderPaid: OrderPaidEvent = {
	kind: 'OrderPaidEvent',
	orderId: oId,
	final: false,
	tagFields: ['orderId'],
};

export const orderPaymentFailed: OrderPaymentFailedEvent = {
	kind: 'OrderPaymentFailedEvent',
	orderId: oId,
	reason: 'Insufficient funds',
	final: false,
	tagFields: ['orderId'],
};

export const orderPrepared: OrderPreparedEvent = {
	kind: 'OrderPreparedEvent',
	orderId: oId,
	final: false,
	tagFields: ['orderId'],
};
