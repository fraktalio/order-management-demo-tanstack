import { describe, it } from 'vitest';
import { DeciderEventSourcedSpec as DeciderSpecification } from '../test-specs.ts';
import { markOrderPaymentFailedDecider } from '../deciders/markOrderPaymentFailed.ts';
import { OrderNotFoundError, OrderAlreadyPaidError } from '../api.ts';
import { oId, orderPlaced, orderPaid, orderPaymentFailed } from '../fixtures.ts';

describe('markOrderPaymentFailedDecider', () => {
	const spec = DeciderSpecification.for(markOrderPaymentFailedDecider);

	it('marks order payment as failed', () => {
		spec
			.given([orderPlaced])
			.when({ kind: 'MarkOrderPaymentFailedCommand', orderId: oId, reason: 'Insufficient funds' })
			.then([orderPaymentFailed]);
	});

	it('throws when order does not exist', () => {
		spec
			.given([])
			.when({ kind: 'MarkOrderPaymentFailedCommand', orderId: oId, reason: 'Insufficient funds' })
			.thenThrows((e: Error) => e instanceof OrderNotFoundError);
	});

	it('ignores duplicate failure (idempotent)', () => {
		spec
			.given([orderPlaced, orderPaymentFailed])
			.when({ kind: 'MarkOrderPaymentFailedCommand', orderId: oId, reason: 'Insufficient funds' })
			.then([]);
	});

	it('throws when order is already paid', () => {
		spec
			.given([orderPlaced, orderPaid])
			.when({ kind: 'MarkOrderPaymentFailedCommand', orderId: oId, reason: 'Insufficient funds' })
			.thenThrows((e: Error) => e instanceof OrderAlreadyPaidError);
	});
});
