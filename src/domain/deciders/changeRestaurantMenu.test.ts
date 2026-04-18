import { describe, it } from 'vitest';
import { DeciderEventSourcedSpec as DeciderSpecification } from '../test-specs.ts';
import { changeRestaurantMenuDecider } from '../deciders/changeRestaurantMenu.ts';
import { RestaurantNotFoundError } from '../api.ts';
import { rId, newMenu, restaurantCreated, menuChanged } from '../fixtures.ts';

describe('changeRestaurantMenuDecider', () => {
	const spec = DeciderSpecification.for(changeRestaurantMenuDecider);

	it('changes menu when restaurant exists', () => {
		spec
			.given([restaurantCreated])
			.when({ kind: 'ChangeRestaurantMenuCommand', restaurantId: rId, menu: newMenu })
			.then([menuChanged]);
	});

	it('throws when restaurant does not exist', () => {
		spec
			.given([])
			.when({ kind: 'ChangeRestaurantMenuCommand', restaurantId: rId, menu: newMenu })
			.thenThrows((e: Error) => e instanceof RestaurantNotFoundError);
	});
});
