import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import type {
	OrderPaidEvent,
	PaymentInitiatedEvent,
	PlaceOrderCommand,
	RestaurantCreatedEvent,
	RestaurantMenuChangedEvent,
	RestaurantOrderPlacedEvent,
} from '@/domain/api.ts';

export const placeOrderRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		PlaceOrderCommand,
		| RestaurantCreatedEvent
		| RestaurantMenuChangedEvent
		| RestaurantOrderPlacedEvent
		| PaymentInitiatedEvent
		| OrderPaidEvent,
		RestaurantOrderPlacedEvent | PaymentInitiatedEvent | OrderPaidEvent
	>(createSqlClient(sql), (cmd) => [
		['restaurantId:' + cmd.restaurantId, 'RestaurantCreatedEvent'],
		['restaurantId:' + cmd.restaurantId, 'RestaurantMenuChangedEvent'],
		['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
		['orderId:' + cmd.orderId, 'PaymentInitiatedEvent'],
		['orderId:' + cmd.orderId, 'OrderPaidEvent'],
	]);
