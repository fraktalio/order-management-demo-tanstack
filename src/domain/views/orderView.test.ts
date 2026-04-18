import { describe, it } from 'vitest';
import { ViewSpecification } from '../test-specs.ts';
import { orderView } from '../views/orderView.ts';
import { rId, oId, menu, orderPlaced, orderPrepared } from '../fixtures.ts';

describe('orderView', () => {
	const spec = ViewSpecification.for(orderView);

	it('projects order from placement event', () => {
		spec
			.given([orderPlaced])
			.then({ orderId: oId, restaurantId: rId, menuItems: menu.menuItems, status: 'CREATED' });
	});

	it('projects prepared status', () => {
		spec
			.given([orderPlaced, orderPrepared])
			.then({ orderId: oId, restaurantId: rId, menuItems: menu.menuItems, status: 'PREPARED' });
	});

	it('returns null with no events', () => {
		spec.given([]).then(null);
	});
});
