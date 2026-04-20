import { describe, it } from 'vitest';
import { DeciderEventSourcedSpec as DeciderSpecification } from '../test-specs.ts';
import { markOrderAsPreparedDecider } from '../deciders/markOrderAsPrepared.ts';
import { OrderNotFoundError, OrderNotPaidError } from '../api.ts';
import { oId, orderPlaced, orderPaid, orderPrepared } from '../fixtures.ts';

describe('markOrderAsPreparedDecider', () => {
	const spec = DeciderSpecification.for(markOrderAsPreparedDecider);

	it('marks order as prepared when paid', () => {
		spec
			.given([orderPlaced, orderPaid])
			.when({ kind: 'MarkOrderAsPreparedCommand', orderId: oId })
			.then([orderPrepared]);
	});

	it('throws when order does not exist', () => {
		spec
			.given([])
			.when({ kind: 'MarkOrderAsPreparedCommand', orderId: oId })
			.thenThrows((e: Error) => e instanceof OrderNotFoundError);
	});

	it('throws when order is not paid', () => {
		spec
			.given([orderPlaced])
			.when({ kind: 'MarkOrderAsPreparedCommand', orderId: oId })
			.thenThrows((e: Error) => e instanceof OrderNotPaidError);
	});

	it('ignores duplicate prepare (idempotent)', () => {
		spec
			.given([orderPlaced, orderPaid, orderPrepared])
			.when({ kind: 'MarkOrderAsPreparedCommand', orderId: oId })
			.then([]); // No new events — already prepared
	});
});
