import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import type {
	PlaceOrderCommand,
	RestaurantCreatedEvent,
	RestaurantMenuChangedEvent,
	RestaurantOrderPlacedEvent,
} from '@/domain/api.ts';

export const placeOrderRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		PlaceOrderCommand,
		RestaurantCreatedEvent | RestaurantMenuChangedEvent | RestaurantOrderPlacedEvent,
		RestaurantOrderPlacedEvent
	>(createSqlClient(sql), (cmd) => [
		['restaurantId:' + cmd.restaurantId, 'RestaurantCreatedEvent'],
		['restaurantId:' + cmd.restaurantId, 'RestaurantMenuChangedEvent'],
		['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
	]);
