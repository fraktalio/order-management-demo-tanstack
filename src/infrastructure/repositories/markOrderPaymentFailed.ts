import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import type {
	MarkOrderPaymentFailedCommand,
	PaymentInitiatedEvent,
	RestaurantOrderPlacedEvent,
	OrderPaidEvent,
	OrderPaymentFailedEvent,
} from '@/domain/api.ts';

export const markOrderPaymentFailedRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		MarkOrderPaymentFailedCommand,
		RestaurantOrderPlacedEvent | PaymentInitiatedEvent | OrderPaidEvent | OrderPaymentFailedEvent,
		OrderPaymentFailedEvent
	>(createSqlClient(sql), (cmd) => [
		['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
		['orderId:' + cmd.orderId, 'PaymentInitiatedEvent'],
		['orderId:' + cmd.orderId, 'OrderPaidEvent'],
		['orderId:' + cmd.orderId, 'OrderPaymentFailedEvent'],
	]);
