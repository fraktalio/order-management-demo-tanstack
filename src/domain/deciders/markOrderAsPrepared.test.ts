import { describe, it } from 'vitest';
import { DeciderEventSourcedSpec as DeciderSpecification } from '../test-specs.ts';
import { markOrderAsPreparedDecider } from '../deciders/markOrderAsPrepared.ts';
import { OrderNotFoundError, OrderAlreadyPreparedError } from '../api.ts';
import { oId, orderPlaced, orderPrepared } from '../fixtures.ts';

describe('markOrderAsPreparedDecider', () => {
	const spec = DeciderSpecification.for(markOrderAsPreparedDecider);

	it('marks order as prepared', () => {
		spec
			.given([orderPlaced])
			.when({ kind: 'MarkOrderAsPreparedCommand', orderId: oId })
			.then([orderPrepared]);
	});

	it('throws when order does not exist', () => {
		spec
			.given([])
			.when({ kind: 'MarkOrderAsPreparedCommand', orderId: oId })
			.thenThrows((e: Error) => e instanceof OrderNotFoundError);
	});

	it('throws when order already prepared', () => {
		spec
			.given([orderPlaced, orderPrepared])
			.when({ kind: 'MarkOrderAsPreparedCommand', orderId: oId })
			.thenThrows((e: Error) => e instanceof OrderAlreadyPreparedError);
	});
});
