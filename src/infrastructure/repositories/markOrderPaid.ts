import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import type {
	MarkOrderPaidCommand,
	PaymentInitiatedEvent,
	RestaurantOrderPlacedEvent,
	OrderPaidEvent,
	OrderPaymentFailedEvent,
	OrderPreparedEvent,
} from '@/domain/api.ts';

export const markOrderPaidRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		MarkOrderPaidCommand,
		| RestaurantOrderPlacedEvent
		| PaymentInitiatedEvent
		| OrderPaidEvent
		| OrderPaymentFailedEvent
		| OrderPreparedEvent,
		OrderPaidEvent
	>(createSqlClient(sql), (cmd) => [
		['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
		['orderId:' + cmd.orderId, 'PaymentInitiatedEvent'],
		['orderId:' + cmd.orderId, 'OrderPaidEvent'],
		['orderId:' + cmd.orderId, 'OrderPaymentFailedEvent'],
		['orderId:' + cmd.orderId, 'OrderPreparedEvent'],
	]);
