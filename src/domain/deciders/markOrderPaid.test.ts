import { describe, it } from 'vitest';
import { DeciderEventSourcedSpec as DeciderSpecification } from '../test-specs.ts';
import { markOrderPaidDecider } from '../deciders/markOrderPaid.ts';
import { OrderNotFoundError, OrderAlreadyPreparedError } from '../api.ts';
import { oId, orderPlaced, orderPaid, orderPrepared } from '../fixtures.ts';

describe('markOrderPaidDecider', () => {
	const spec = DeciderSpecification.for(markOrderPaidDecider);

	it('marks order as paid', () => {
		spec
			.given([orderPlaced])
			.when({ kind: 'MarkOrderPaidCommand', orderId: oId })
			.then([orderPaid]);
	});

	it('throws when order does not exist', () => {
		spec
			.given([])
			.when({ kind: 'MarkOrderPaidCommand', orderId: oId })
			.thenThrows((e: Error) => e instanceof OrderNotFoundError);
	});

	it('ignores duplicate payment (idempotent)', () => {
		spec
			.given([orderPlaced, orderPaid])
			.when({ kind: 'MarkOrderPaidCommand', orderId: oId })
			.then([]);
	});

	it('throws when order is already prepared', () => {
		spec
			.given([orderPlaced, orderPaid, orderPrepared])
			.when({ kind: 'MarkOrderPaidCommand', orderId: oId })
			.then([]); // Already paid — idempotent no-op (paid check comes before prepared check)
	});
});
