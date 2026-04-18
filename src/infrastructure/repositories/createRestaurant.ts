import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import type { CreateRestaurantCommand, RestaurantCreatedEvent } from '@/domain/api.ts';

export const createRestaurantRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		CreateRestaurantCommand,
		RestaurantCreatedEvent,
		RestaurantCreatedEvent
	>(createSqlClient(sql), (cmd) => [
		['restaurantId:' + cmd.restaurantId, 'RestaurantCreatedEvent'],
	]);
