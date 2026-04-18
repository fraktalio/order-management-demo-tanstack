import { WorkflowEntrypoint, type WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import { withDb } from '@/infrastructure/db';
import { placeOrderHandler } from '@/application/command-handlers/placeOrder';
import { markOrderAsPreparedHandler } from '@/application/command-handlers/markOrderAsPrepared';
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
					await handler.handle({
						kind: 'PlaceOrderCommand',
						restaurantId: restaurantId(rid),
						orderId: orderId(oid),
						menuItems: menuItems.map((item) => ({
							menuItemId: menuItemId(item.menuItemId),
							name: item.name,
							price: item.price,
						})),
					});
					return { orderId: oid, restaurantId: rid, status: 'placed' };
				});
			},
		);

		// Step 2: Wait for payment confirmation from the dummy payment gateway
		const paymentEvent = await step.waitForEvent<PaymentEvent>('await payment from gateway', {
			type: 'payment-received',
			timeout: '1 hour',
		});

		// Step 3: Process payment result
		const paymentResult = await step.do('process-payment', async () => {
			if (paymentEvent.payload.status !== 'success') {
				throw new Error(`Payment failed — transaction ${paymentEvent.payload.transactionId}`);
			}
			return {
				transactionId: paymentEvent.payload.transactionId,
				amount: paymentEvent.payload.amount,
				status: 'confirmed',
			};
		});

		// Step 4: Mark order as prepared (simulating kitchen auto-confirm after payment)
		await step.do(
			'mark-order-prepared',
			{ retries: { limit: 3, delay: '1 second', backoff: 'exponential' }, timeout: '15 seconds' },
			async () => {
				return withDb(this.env, async (sql) => {
					const handler = markOrderAsPreparedHandler(sql);
					await handler.handle({
						kind: 'MarkOrderAsPreparedCommand',
						orderId: orderId(oid),
					});
					return { orderId: oid, status: 'prepared' };
				});
			},
		);

		return {
			orderId: orderResult.orderId,
			restaurantId: orderResult.restaurantId,
			payment: paymentResult,
			finalStatus: 'prepared',
		};
	}
}
