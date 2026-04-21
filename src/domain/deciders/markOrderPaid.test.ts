import { describe, it } from 'vitest';
import { DeciderEventSourcedSpec as DeciderSpecification } from '../test-specs.ts';
import { markOrderPaidDecider } from '../deciders/markOrderPaid.ts';
import { OrderNotFoundError, PaymentNotInitiatedError } from '../api.ts';
import {
	oId,
	orderPlaced,
	paymentInitiated,
	orderPaid,
	orderPaymentFailed,
	orderPrepared,
} from '../fixtures.ts';

describe('markOrderPaidDecider', () => {
	const spec = DeciderSpecification.for(markOrderPaidDecider);

	it('marks order as paid when payment was initiated', () => {
		spec
			.given([orderPlaced, paymentInitiated])
			.when({ kind: 'MarkOrderPaidCommand', orderId: oId })
			.then([orderPaid]);
	});

	it('marks order as paid after a previous payment failure (retry)', () => {
		spec
			.given([orderPlaced, paymentInitiated, orderPaymentFailed])
			.when({ kind: 'MarkOrderPaidCommand', orderId: oId })
			.then([orderPaid]);
	});

	it('throws when order does not exist', () => {
		spec
			.given([])
			.when({ kind: 'MarkOrderPaidCommand', orderId: oId })
			.thenThrows((e: Error) => e instanceof OrderNotFoundError);
	});

	it('throws when payment was not initiated', () => {
		spec
			.given([orderPlaced])
			.when({ kind: 'MarkOrderPaidCommand', orderId: oId })
			.thenThrows((e: Error) => e instanceof PaymentNotInitiatedError);
	});

	it('ignores duplicate payment (idempotent)', () => {
		spec
			.given([orderPlaced, paymentInitiated, orderPaid])
			.when({ kind: 'MarkOrderPaidCommand', orderId: oId })
			.then([]);
	});

	it('is idempotent when already paid even if prepared', () => {
		spec
			.given([orderPlaced, paymentInitiated, orderPaid, orderPrepared])
			.when({ kind: 'MarkOrderPaidCommand', orderId: oId })
			.then([]);
	});
});
