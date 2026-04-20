import type postgres from 'postgres';
import { EventSourcedCommandHandler } from '@fraktalio/fmodel-decider';
import { markOrderPaymentFailedDecider } from '@/domain/deciders/markOrderPaymentFailed.ts';
import { markOrderPaymentFailedRepository } from '@/infrastructure/repositories/markOrderPaymentFailed.ts';

export const markOrderPaymentFailedHandler = (sql: postgres.Sql) =>
	new EventSourcedCommandHandler(
		markOrderPaymentFailedDecider,
		markOrderPaymentFailedRepository(sql),
	);
