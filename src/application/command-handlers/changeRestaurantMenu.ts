import type postgres from 'postgres';
import { EventSourcedCommandHandler } from '@fraktalio/fmodel-decider';
import { changeRestaurantMenuDecider } from '@/domain/deciders/changeRestaurantMenu.ts';
import { changeRestaurantMenuRepository } from '@/infrastructure/repositories/changeRestaurantMenu.ts';

export const changeRestaurantMenuHandler = (sql: postgres.Sql) =>
	new EventSourcedCommandHandler(changeRestaurantMenuDecider, changeRestaurantMenuRepository(sql));
