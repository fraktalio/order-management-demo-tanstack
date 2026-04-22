import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import type {
	MarkOrderAsPreparedCommand,
	OrderPaidEvent,
	OrderPreparedEvent,
	PaymentExemptedEvent,
	RestaurantOrderPlacedEvent,
} from '@/domain/api.ts';

export const markOrderAsPreparedRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		MarkOrderAsPreparedCommand,
		RestaurantOrderPlacedEvent | PaymentExemptedEvent | OrderPaidEvent | OrderPreparedEvent,
		OrderPreparedEvent
	>(createSqlClient(sql), (cmd) => [
		['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
		['orderId:' + cmd.orderId, 'PaymentExemptedEvent'],
		['orderId:' + cmd.orderId, 'OrderPaidEvent'],
		['orderId:' + cmd.orderId, 'OrderPreparedEvent'],
	]);
