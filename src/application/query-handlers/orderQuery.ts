import type postgres from 'postgres';
import { EventSourcedQueryHandler, PostgresEventLoader } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '@/infrastructure/pg-client-adapter.ts';
import { orderView, type OrderEvent } from '@/domain/views/orderView.ts';

export const orderQueryHandler = (sql: postgres.Sql) =>
	new EventSourcedQueryHandler(
		orderView,
		new PostgresEventLoader<OrderEvent>(createSqlClient(sql)),
	);
