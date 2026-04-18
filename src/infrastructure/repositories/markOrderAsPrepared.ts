import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import type {
	MarkOrderAsPreparedCommand,
	RestaurantOrderPlacedEvent,
	OrderPreparedEvent,
} from '@/domain/api.ts';

export const markOrderAsPreparedRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		MarkOrderAsPreparedCommand,
		RestaurantOrderPlacedEvent | OrderPreparedEvent,
		OrderPreparedEvent
	>(createSqlClient(sql), (cmd) => [
		['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
		['orderId:' + cmd.orderId, 'OrderPreparedEvent'],
	]);
