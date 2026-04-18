import handler from '@tanstack/react-start/server-entry';
import { WorkflowEntrypoint, WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import { withDb } from './infrastructure/db';

export default {
	// TanStack handles the web request
	fetch: handler.fetch,

	// Handle Queue messages
	//   async queue(batch, env, ctx) {
	//     for (const message of batch.messages) {
	//       console.log("Processing message:", message.body);
	//       message.ack();
	//     }
	//   },

	// Handle Cron Triggers
	//   async scheduled(event, env, ctx) {
	//     console.log("Cron triggered:", event.cron);
	//   },
};

export class MyWorkflow extends WorkflowEntrypoint<Env> {
	async run(event: WorkflowEvent<{ input: string }>, step: WorkflowStep) {
		const result = await step.do(
			'process data',
			{ retries: { limit: 3, delay: '1 second', backoff: 'exponential' }, timeout: '10 seconds' },
			async () => {
				return withDb(this.env, async (sql) => {
					const rows = await sql`SELECT current_database(), current_user, version()`;
					return `Processed: ${event.payload.input} - ${JSON.stringify(rows)}`;
				});
			},
		);

		await step.sleep('wait', '5 seconds');

		await step.do('finalize', async () => {
			console.log('[Workflow] Finalize — result:', result);
		});

		return { result };
	}
}
