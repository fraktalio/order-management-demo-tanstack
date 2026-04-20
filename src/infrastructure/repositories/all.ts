import type postgres from 'postgres';
import { PostgresEventRepository, type EventMetadata } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import { createRestaurantDecider } from '@/domain/deciders/createRestaurant.ts';
import { changeRestaurantMenuDecider } from '@/domain/deciders/changeRestaurantMenu.ts';
import { placeOrderDecider } from '@/domain/deciders/placeOrder.ts';
import { markOrderPaidDecider } from '@/domain/deciders/markOrderPaid.ts';
import { markOrderPaymentFailedDecider } from '@/domain/deciders/markOrderPaymentFailed.ts';
import { markOrderAsPreparedDecider } from '@/domain/deciders/markOrderAsPrepared.ts';
import type { Command, Event } from '@/domain/api.ts';

export class AllDeciderRepository {
	private readonly repository: PostgresEventRepository<Command, Event, Event>;

	private readonly combinedDecider = createRestaurantDecider
		.combineViaTuples(changeRestaurantMenuDecider)
		.combineViaTuples(placeOrderDecider)
		.combineViaTuples(markOrderPaidDecider)
		.combineViaTuples(markOrderPaymentFailedDecider)
		.combineViaTuples(markOrderAsPreparedDecider);

	constructor(sql: postgres.Sql) {
		this.repository = new PostgresEventRepository(createSqlClient(sql), (cmd: Command) => {
			switch (cmd.kind) {
				case 'CreateRestaurantCommand':
					return [['restaurantId:' + cmd.restaurantId, 'RestaurantCreatedEvent']];
				case 'ChangeRestaurantMenuCommand':
					return [['restaurantId:' + cmd.restaurantId, 'RestaurantCreatedEvent']];
				case 'PlaceOrderCommand':
					return [
						['restaurantId:' + cmd.restaurantId, 'RestaurantCreatedEvent'],
						['restaurantId:' + cmd.restaurantId, 'RestaurantMenuChangedEvent'],
						['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
					];
				case 'MarkOrderPaidCommand':
					return [
						['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
						['orderId:' + cmd.orderId, 'OrderPaidEvent'],
					];
				case 'MarkOrderPaymentFailedCommand':
					return [
						['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
						['orderId:' + cmd.orderId, 'OrderPaidEvent'],
						['orderId:' + cmd.orderId, 'OrderPaymentFailedEvent'],
					];
				case 'MarkOrderAsPreparedCommand':
					return [
						['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
						['orderId:' + cmd.orderId, 'OrderPaidEvent'],
						['orderId:' + cmd.orderId, 'OrderPreparedEvent'],
					];
				default: {
					// @ts-expect-error exhaustive check
					const _exhaustiveCheck: never = cmd;
					return [];
				}
			}
		});
	}

	execute(command: Command): Promise<readonly (Event & EventMetadata)[]> {
		return this.repository.execute(command, this.combinedDecider);
	}

	executeBatch(commands: readonly Command[]): Promise<readonly (Event & EventMetadata)[]> {
		return this.repository.executeBatch(commands, this.combinedDecider);
	}
}
