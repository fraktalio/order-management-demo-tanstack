import { describe, it } from 'vitest';
import { DeciderEventSourcedSpec as DeciderSpecification } from '../test-specs.ts';
import { placeOrderDecider } from '../deciders/placeOrder.ts';
import { RestaurantNotFoundError, MenuItemsNotAvailableError, menuItemId } from '../api.ts';
import {
	rId,
	oId,
	menu,
	newMenu,
	restaurantCreated,
	menuChanged,
	orderPlaced,
} from '../fixtures.ts';

describe('placeOrderDecider', () => {
	const spec = DeciderSpecification.for(placeOrderDecider);

	it('places an order when restaurant exists and items are on menu', () => {
		spec
			.given([restaurantCreated])
			.when({
				kind: 'PlaceOrderCommand',
				restaurantId: rId,
				orderId: oId,
				menuItems: menu.menuItems,
			})
			.then([orderPlaced]);
	});

	it('throws when restaurant does not exist', () => {
		spec
			.given([])
			.when({
				kind: 'PlaceOrderCommand',
				restaurantId: rId,
				orderId: oId,
				menuItems: menu.menuItems,
			})
			.thenThrows((e: Error) => e instanceof RestaurantNotFoundError);
	});

	it('ignores duplicate order (idempotent)', () => {
		spec
			.given([restaurantCreated, orderPlaced])
			.when({
				kind: 'PlaceOrderCommand',
				restaurantId: rId,
				orderId: oId,
				menuItems: menu.menuItems,
			})
			.then([]); // No new events — already placed
	});

	it('throws when menu items are not available', () => {
		spec
			.given([restaurantCreated])
			.when({
				kind: 'PlaceOrderCommand',
				restaurantId: rId,
				orderId: oId,
				menuItems: [{ menuItemId: menuItemId('unknown'), name: 'Nope', price: '0' }],
			})
			.thenThrows((e: Error) => e instanceof MenuItemsNotAvailableError);
	});

	it('uses updated menu after menu change', () => {
		spec
			.given([restaurantCreated, menuChanged])
			.when({
				kind: 'PlaceOrderCommand',
				restaurantId: rId,
				orderId: oId,
				menuItems: newMenu.menuItems,
			})
			.then([
				{
					kind: 'RestaurantOrderPlacedEvent',
					restaurantId: rId,
					orderId: oId,
					menuItems: newMenu.menuItems,
					final: false,
					tagFields: ['restaurantId', 'orderId'],
				},
			]);
	});
});
