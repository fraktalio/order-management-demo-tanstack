import type postgres from 'postgres';
import { EventSourcedQueryHandler, PostgresEventLoader } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '@/infrastructure/pg-client-adapter.ts';
import { orderView } from '@/domain/views/orderView.ts';
import type { OrderPreparedEvent, RestaurantOrderPlacedEvent } from '@/domain/api.ts';

type OrderEvent = RestaurantOrderPlacedEvent | OrderPreparedEvent;

export const orderQueryHandler = (sql: postgres.Sql) =>
	new EventSourcedQueryHandler(
		orderView,
		new PostgresEventLoader<OrderEvent>(createSqlClient(sql)),
	);
