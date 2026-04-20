import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import type {
	MarkOrderPaidCommand,
	RestaurantOrderPlacedEvent,
	OrderPaidEvent,
} from '@/domain/api.ts';

export const markOrderPaidRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		MarkOrderPaidCommand,
		RestaurantOrderPlacedEvent | OrderPaidEvent,
		OrderPaidEvent
	>(createSqlClient(sql), (cmd) => [
		['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
		['orderId:' + cmd.orderId, 'OrderPaidEvent'],
	]);
