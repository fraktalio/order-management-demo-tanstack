import { WorkflowEntrypoint, type WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import { withDb } from '@/infrastructure/db';
import { placeOrderHandler } from '@/application/command-handlers/placeOrder';
import { markOrderPaidHandler } from '@/application/command-handlers/markOrderPaid';
import { markOrderPaymentFailedHandler } from '@/application/command-handlers/markOrderPaymentFailed';
import { restaurantId, orderId, menuItemId } from '@/domain/api';

// ─── Workflow Payload Types ─────────────────────────────────────────

export type OrderWorkflowParams = {
	restaurantId: string;
	orderId: string;
	menuItems: { menuItemId: string; name: string; price: string }[];
};

export type PaymentEvent = {
	transactionId: string;
	amount: string;
	status: 'success' | 'failed';
};

// ─── Payment Workflow ───────────────────────────────────────────────

export class PaymentWorkflow extends WorkflowEntrypoint<Env> {
	async run(event: WorkflowEvent<OrderWorkflowParams>, step: WorkflowStep) {
		const { restaurantId: rid, orderId: oid, menuItems } = event.payload;

		// Step 1: Place the order via the domain command handler
		const orderResult = await step.do(
			'place-order',
			{ retries: { limit: 3, delay: '1 second', backoff: 'exponential' }, timeout: '15 seconds' },
			async () => {
				return withDb(this.env, async (sql) => {
					const handler = placeOrderHandler(sql);
					const events = await handler.handle({
						kind: 'PlaceOrderCommand',
						restaurantId: restaurantId(rid),
						orderId: orderId(oid),
						menuItems: menuItems.map((item) => ({
							menuItemId: menuItemId(item.menuItemId),
							name: item.name,
							price: item.price,
						})),
					});
					const paymentRequired = events.some((e) => e.kind === 'PaymentInitiatedEvent');
					return { orderId: oid, restaurantId: rid, status: 'placed', paymentRequired };
				});
			},
		);

		if (orderResult.paymentRequired) {
			// Step 2a: Wait for payment confirmation from the payment gateway
			const paymentEvent = await step.waitForEvent<PaymentEvent>('await payment from gateway', {
				type: 'payment-received',
				timeout: '1 hour',
			});

			// Step 3a: Mark order as paid or payment failed based on gateway response
			if (paymentEvent.payload.status === 'success') {
				await step.do(
					'mark-order-paid',
					{
						retries: { limit: 3, delay: '1 second', backoff: 'exponential' },
						timeout: '15 seconds',
					},
					async () => {
						return withDb(this.env, async (sql) => {
							const handler = markOrderPaidHandler(sql);
							await handler.handle({
								kind: 'MarkOrderPaidCommand',
								orderId: orderId(oid),
							});
							return { orderId: oid, status: 'paid' };
						});
					},
				);

				return {
					orderId: orderResult.orderId,
					restaurantId: orderResult.restaurantId,
					payment: {
						transactionId: paymentEvent.payload.transactionId,
						amount: paymentEvent.payload.amount,
						status: 'confirmed',
					},
					finalStatus: 'paid',
				};
			} else {
				await step.do(
					'mark-order-payment-failed',
					{
						retries: { limit: 3, delay: '1 second', backoff: 'exponential' },
						timeout: '15 seconds',
					},
					async () => {
						return withDb(this.env, async (sql) => {
							const handler = markOrderPaymentFailedHandler(sql);
							await handler.handle({
								kind: 'MarkOrderPaymentFailedCommand',
								orderId: orderId(oid),
								reason: `Payment failed — transaction ${paymentEvent.payload.transactionId}`,
							});
							return { orderId: oid, status: 'payment_failed' };
						});
					},
				);

				return {
					orderId: orderResult.orderId,
					restaurantId: orderResult.restaurantId,
					payment: {
						transactionId: paymentEvent.payload.transactionId,
						amount: paymentEvent.payload.amount,
						status: 'failed',
					},
					finalStatus: 'payment_failed',
				};
			}
		} else {
			// Free order — already marked as paid by PlaceOrderCommand (emitted OrderPaidEvent)
			return {
				orderId: orderResult.orderId,
				restaurantId: orderResult.restaurantId,
				payment: null,
				finalStatus: 'paid',
			};
		}
	}
}
