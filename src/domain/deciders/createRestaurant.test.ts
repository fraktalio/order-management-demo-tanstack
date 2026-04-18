import { describe, it } from 'vitest';
import { DeciderEventSourcedSpec as DeciderSpecification } from '../test-specs.ts';
import { createRestaurantDecider } from '../deciders/createRestaurant.ts';
import { RestaurantAlreadyExistsError } from '../api.ts';
import { rId, menu, restaurantCreated } from '../fixtures.ts';

describe('createRestaurantDecider', () => {
	const spec = DeciderSpecification.for(createRestaurantDecider);

	it('creates a restaurant when none exists', () => {
		spec
			.given([])
			.when({ kind: 'CreateRestaurantCommand', restaurantId: rId, name: 'Test Restaurant', menu })
			.then([restaurantCreated]);
	});

	it('throws when restaurant already exists', () => {
		spec
			.given([restaurantCreated])
			.when({ kind: 'CreateRestaurantCommand', restaurantId: rId, name: 'Test Restaurant', menu })
			.thenThrows((e: Error) => e instanceof RestaurantAlreadyExistsError);
	});
});
