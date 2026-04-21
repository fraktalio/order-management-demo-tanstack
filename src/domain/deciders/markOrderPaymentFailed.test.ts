import { describe, it } from 'vitest';
import { DeciderEventSourcedSpec as DeciderSpecification } from '../test-specs.ts';
import { markOrderPaymentFailedDecider } from '../deciders/markOrderPaymentFailed.ts';
import {
	OrderNotFoundError,
	OrderAlreadyPaidError,
	OrderAlreadyPreparedError,
	PaymentNotInitiatedError,
} from '../api.ts';
import {
	oId,
	orderPlaced,
	paymentInitiated,
	orderPaid,
	orderPrepared,
	orderPaymentFailed,
} from '../fixtures.ts';

describe('markOrderPaymentFailedDecider', () => {
	const spec = DeciderSpecification.for(markOrderPaymentFailedDecider);

	it('marks order payment as failed when payment was initiated', () => {
		spec
			.given([orderPlaced, paymentInitiated])
			.when({ kind: 'MarkOrderPaymentFailedCommand', orderId: oId, reason: 'Insufficient funds' })
			.then([orderPaymentFailed]);
	});

	it('throws when order does not exist', () => {
		spec
			.given([])
			.when({ kind: 'MarkOrderPaymentFailedCommand', orderId: oId, reason: 'Insufficient funds' })
			.thenThrows((e: Error) => e instanceof OrderNotFoundError);
	});

	it('throws when payment was not initiated', () => {
		spec
			.given([orderPlaced])
			.when({ kind: 'MarkOrderPaymentFailedCommand', orderId: oId, reason: 'Insufficient funds' })
			.thenThrows((e: Error) => e instanceof PaymentNotInitiatedError);
	});

	it('ignores duplicate failure (idempotent)', () => {
		spec
			.given([orderPlaced, paymentInitiated, orderPaymentFailed])
			.when({ kind: 'MarkOrderPaymentFailedCommand', orderId: oId, reason: 'Insufficient funds' })
			.then([]);
	});

	it('throws when order is already paid', () => {
		spec
			.given([orderPlaced, paymentInitiated, orderPaid])
			.when({ kind: 'MarkOrderPaymentFailedCommand', orderId: oId, reason: 'Insufficient funds' })
			.thenThrows((e: Error) => e instanceof OrderAlreadyPaidError);
	});

	it('throws when order is already prepared', () => {
		spec
			.given([orderPlaced, paymentInitiated, orderPaid, orderPrepared])
			.when({ kind: 'MarkOrderPaymentFailedCommand', orderId: oId, reason: 'Insufficient funds' })
			.thenThrows((e: Error) => e instanceof OrderAlreadyPreparedError);
	});
});
