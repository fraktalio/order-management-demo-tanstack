import type postgres from 'postgres';
import { EventSourcedCommandHandler } from '@fraktalio/fmodel-decider';
import { createRestaurantDecider } from '@/domain/deciders/createRestaurant.ts';
import { createRestaurantRepository } from '@/infrastructure/repositories/createRestaurant.ts';

export const createRestaurantHandler = (sql: postgres.Sql) =>
	new EventSourcedCommandHandler(createRestaurantDecider, createRestaurantRepository(sql));
