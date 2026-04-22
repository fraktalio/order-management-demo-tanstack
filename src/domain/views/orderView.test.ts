import { describe, it } from 'vitest';
import { ViewSpecification } from '../test-specs.ts';
import { orderView } from '../views/orderView.ts';
import {
	rId,
	oId,
	menu,
	orderPlaced,
	orderPaid,
	paymentExempted,
	orderPaymentFailed,
	orderPrepared,
} from '../fixtures.ts';

describe('orderView', () => {
	const spec = ViewSpecification.for(orderView);

	it('projects order from placement event', () => {
		spec
			.given([orderPlaced])
			.then({ orderId: oId, restaurantId: rId, menuItems: menu.menuItems, status: 'CREATED' });
	});

	it('projects paid status', () => {
		spec
			.given([orderPlaced, orderPaid])
			.then({ orderId: oId, restaurantId: rId, menuItems: menu.menuItems, status: 'PAID' });
	});

	it('projects paid status when payment exempted (free order)', () => {
		spec
			.given([orderPlaced, paymentExempted])
			.then({ orderId: oId, restaurantId: rId, menuItems: menu.menuItems, status: 'PAID' });
	});

	it('projects payment failed status', () => {
		spec.given([orderPlaced, orderPaymentFailed]).then({
			orderId: oId,
			restaurantId: rId,
			menuItems: menu.menuItems,
			status: 'PAYMENT_FAILED',
		});
	});

	it('projects prepared status', () => {
		spec
			.given([orderPlaced, orderPaid, orderPrepared])
			.then({ orderId: oId, restaurantId: rId, menuItems: menu.menuItems, status: 'PREPARED' });
	});

	it('returns null with no events', () => {
		spec.given([]).then(null);
	});
});
