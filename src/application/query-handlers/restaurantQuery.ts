import type postgres from 'postgres';
import { EventSourcedQueryHandler, PostgresEventLoader } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '@/infrastructure/pg-client-adapter.ts';
import { restaurantView, type RestaurantEvent } from '@/domain/views/restaurantView.ts';

export const restaurantQueryHandler = (sql: postgres.Sql) =>
	new EventSourcedQueryHandler(
		restaurantView,
		new PostgresEventLoader<RestaurantEvent>(createSqlClient(sql)),
	);
