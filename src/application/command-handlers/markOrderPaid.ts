import type postgres from 'postgres';
import { EventSourcedCommandHandler } from '@fraktalio/fmodel-decider';
import { markOrderPaidDecider } from '@/domain/deciders/markOrderPaid.ts';
import { markOrderPaidRepository } from '@/infrastructure/repositories/markOrderPaid.ts';

export const markOrderPaidHandler = (sql: postgres.Sql) =>
	new EventSourcedCommandHandler(markOrderPaidDecider, markOrderPaidRepository(sql));
