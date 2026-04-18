import type postgres from 'postgres';
import { EventSourcedCommandHandler } from '@fraktalio/fmodel-decider';
import { placeOrderDecider } from '@/domain/deciders/placeOrder.ts';
import { placeOrderRepository } from '@/infrastructure/repositories/placeOrder.ts';

export const placeOrderHandler = (sql: postgres.Sql) =>
	new EventSourcedCommandHandler(placeOrderDecider, placeOrderRepository(sql));
