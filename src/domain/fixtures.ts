import {
	type RestaurantCreatedEvent,
	type RestaurantMenuChangedEvent,
	type RestaurantOrderPlacedEvent,
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

export const orderPrepared: OrderPreparedEvent = {
	kind: 'OrderPreparedEvent',
	orderId: oId,
	final: false,
	tagFields: ['orderId'],
};
