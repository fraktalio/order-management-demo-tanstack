import type postgres from 'postgres';
import { EventSourcedCommandHandler } from '@fraktalio/fmodel-decider';
import { markOrderAsPreparedDecider } from '@/domain/deciders/markOrderAsPrepared.ts';
import { markOrderAsPreparedRepository } from '@/infrastructure/repositories/markOrderAsPrepared.ts';

export const markOrderAsPreparedHandler = (sql: postgres.Sql) =>
	new EventSourcedCommandHandler(markOrderAsPreparedDecider, markOrderAsPreparedRepository(sql));
