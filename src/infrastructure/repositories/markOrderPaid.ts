import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import type {
	MarkOrderPaidCommand,
	RestaurantOrderPlacedEvent,
	OrderPaidEvent,
	OrderPreparedEvent,
} from '@/domain/api.ts';

export const markOrderPaidRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		MarkOrderPaidCommand,
		RestaurantOrderPlacedEvent | OrderPaidEvent | OrderPreparedEvent,
		OrderPaidEvent
	>(createSqlClient(sql), (cmd) => [
		['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
		['orderId:' + cmd.orderId, 'OrderPaidEvent'],
		['orderId:' + cmd.orderId, 'OrderPreparedEvent'],
	]);
