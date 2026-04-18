import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import type {
	ChangeRestaurantMenuCommand,
	RestaurantCreatedEvent,
	RestaurantMenuChangedEvent,
} from '@/domain/api.ts';

export const changeRestaurantMenuRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		ChangeRestaurantMenuCommand,
		RestaurantCreatedEvent,
		RestaurantMenuChangedEvent
	>(createSqlClient(sql), (cmd) => [
		['restaurantId:' + cmd.restaurantId, 'RestaurantCreatedEvent'],
	]);
