import { describe, it } from 'vitest';
import { ViewSpecification } from '../test-specs.ts';
import { restaurantView } from '../views/restaurantView.ts';
import { rId, menu, newMenu, restaurantCreated, menuChanged } from '../fixtures.ts';

describe('restaurantView', () => {
	const spec = ViewSpecification.for(restaurantView);

	it('projects restaurant from creation event', () => {
		spec.given([restaurantCreated]).then({ restaurantId: rId, name: 'Test Restaurant', menu });
	});

	it('projects menu change', () => {
		spec
			.given([restaurantCreated, menuChanged])
			.then({ restaurantId: rId, name: 'Test Restaurant', menu: newMenu });
	});

	it('returns null with no events', () => {
		spec.given([]).then(null);
	});
});
