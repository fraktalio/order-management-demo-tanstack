# Infrastructure & Application Patterns Reference

## 1. Database Helper (`src/infrastructure/db.ts`)

```typescript
import postgres from 'postgres';

export async function withDb<T>(env: Env, fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
	const sql = postgres(env.HYPERDRIVE.connectionString, {
		connect_timeout: 10,
		idle_timeout: 0,
		max: 1,
	});
	try {
		return await fn(sql);
	} catch (err) {
		console.error('[DB]', err);
		throw new Error('Database error occurred');
	} finally {
		await sql.end({ timeout: 5 }).catch((err) => {
			console.error('[DB] Failed to close connection:', err);
		});
	}
}
```

Key points:

- Uses `env.HYPERDRIVE.connectionString` for both local dev and production
- `max: 1` — single connection per request (Cloudflare Workers model)
- Always closes connection in `finally` block
- Wraps errors to avoid leaking internal details

## 2. Postgres.js → SqlClient Adapter (`src/infrastructure/pg-client-adapter.ts`)

```typescript
import type postgres from 'postgres';
// @ts-expect-error JSR npm compat layer TS resolution quirk — works at runtime
import type { SqlClient } from '@fraktalio/fmodel-decider';

export const createSqlClient = (sql: postgres.Sql): SqlClient => ({
	queryObject: async <T>(query: string) => ({ rows: (await sql.unsafe(query)) as T[] }),
});
```

This adapts postgres.js to the `SqlClient` interface required by
`PostgresEventRepository` and `PostgresEventLoader`.

## 3. Repositories (`src/infrastructure/repositories/`)

### Simple Repository (single entity)

```typescript
import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import type { CreateRestaurantCommand, RestaurantCreatedEvent } from '@/domain/api.ts';

export const createRestaurantRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		CreateRestaurantCommand, // C  — command type
		RestaurantCreatedEvent, // Ei — input event type (same as decider)
		RestaurantCreatedEvent // Eo — output event type (same as decider)
	>(createSqlClient(sql), (cmd) => [
		['restaurantId:' + cmd.restaurantId, 'RestaurantCreatedEvent'],
	]);
```

### Cross-Entity Repository

```typescript
export const placeOrderRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		PlaceOrderCommand,
		RestaurantCreatedEvent | RestaurantMenuChangedEvent | RestaurantOrderPlacedEvent,
		RestaurantOrderPlacedEvent | PaymentInitiatedEvent | PaymentExemptedEvent
	>(createSqlClient(sql), (cmd) => [
		['restaurantId:' + cmd.restaurantId, 'RestaurantCreatedEvent'],
		['restaurantId:' + cmd.restaurantId, 'RestaurantMenuChangedEvent'],
		['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
	]);
```

### Repository Query Tuple Rules

Each tuple is `[tag, eventType]`:

- **Tag format**: `"fieldName:" + value` (e.g., `"restaurantId:" + cmd.restaurantId`)
- **Event type**: the `kind` string of the event to load
- One tuple per `(tag, eventType)` combination the decider needs
- The tuples must cover ALL input events (`Ei`) the decider reads
- Tags correspond to the `tagFields` declared on events

### Deriving Query Tuples from Decider

For each event type in the decider's `Ei`:

1. Look at the event's `tagFields` to find which ID fields are tagged
2. Look at the command's fields to find the matching ID value
3. Create tuple: `['tagField:' + cmd.fieldValue, 'EventKindString']`

Example: `markOrderPaidDecider` reads `RestaurantOrderPlacedEvent | PaymentInitiatedEvent | OrderPaidEvent`, all tagged by `orderId`:

```typescript
(cmd) => [
	['orderId:' + cmd.orderId, 'RestaurantOrderPlacedEvent'],
	['orderId:' + cmd.orderId, 'PaymentInitiatedEvent'],
	['orderId:' + cmd.orderId, 'OrderPaidEvent'],
];
```

## 4. Command Handlers (`src/application/command-handlers/`)

```typescript
import type postgres from 'postgres';
import { EventSourcedCommandHandler } from '@fraktalio/fmodel-decider';
import { createRestaurantDecider } from '@/domain/deciders/createRestaurant.ts';
import { createRestaurantRepository } from '@/infrastructure/repositories/createRestaurant.ts';

export const createRestaurantHandler = (sql: postgres.Sql) =>
	new EventSourcedCommandHandler(createRestaurantDecider, createRestaurantRepository(sql));
```

Pattern: `handler = new EventSourcedCommandHandler(decider, repository)`

Usage: `const events = await handler.handle(command)`

## 5. Query Handlers (`src/application/query-handlers/`)

```typescript
import type postgres from 'postgres';
import { EventSourcedQueryHandler, PostgresEventLoader } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '@/infrastructure/pg-client-adapter.ts';
import { restaurantView, type RestaurantEvent } from '@/domain/views/restaurantView.ts';

export const restaurantQueryHandler = (sql: postgres.Sql) =>
	new EventSourcedQueryHandler(
		restaurantView,
		new PostgresEventLoader<RestaurantEvent>(createSqlClient(sql)),
	);
```

Pattern: `handler = new EventSourcedQueryHandler(view, new PostgresEventLoader(sqlClient))`

Usage: `const state = await handler.handle(queryTuples)`

Query tuples for views follow the same format as repository tuples:

```typescript
const state = await handler.handle([
	['restaurantId:' + rid, 'RestaurantCreatedEvent'],
	['restaurantId:' + rid, 'RestaurantMenuChangedEvent'],
]);
```

## 6. API Helpers (`src/application/api.ts`)

```typescript
import { DomainError } from '@/domain/api.ts';

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function handleCommand<T>(fn: () => Promise<T>): Promise<Response> {
	try {
		const result = await fn();
		return json(result, 201);
	} catch (error) {
		if (error instanceof DomainError) {
			return json({ error: error.message }, 409);
		}
		console.error('[API]', error);
		return json({ error: 'Internal server error' }, 500);
	}
}
```

- Domain errors → 409 Conflict
- Unknown errors → 500 Internal Server Error
- Success → 201 Created

## 7. Cloudflare Workflows (`src/application/workflows/`)

```typescript
import { WorkflowEntrypoint, type WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import { withDb } from '@/infrastructure/db';
import { placeOrderHandler } from '@/application/command-handlers/placeOrder';
import { markOrderPaidHandler } from '@/application/command-handlers/markOrderPaid';
import { restaurantId, orderId, menuItemId } from '@/domain/api';

export type OrderWorkflowParams = {
  restaurantId: string;
  orderId: string;
  menuItems: { menuItemId: string; name: string; price: string }[];
};

export class PaymentWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<OrderWorkflowParams>, step: WorkflowStep) {
    const { restaurantId: rid, orderId: oid, menuItems } = event.payload;

    // Step 1: Execute a command handler
    const result = await step.do(
      'step-name',
      { retries: { limit: 3, delay: '1 second', backoff: 'exponential' }, timeout: '15 seconds' },
      async () => {
        return withDb(this.env, async (sql) => {
          const handler = placeOrderHandler(sql);
          const events = await handler.handle({ kind: 'PlaceOrderCommand', ... });
          return { /* serializable result */ };
        });
      },
    );

    // Step 2: Wait for external event
    const externalEvent = await step.waitForEvent<PaymentEvent>('await payment', {
      type: 'payment-received',
      timeout: '1 hour',
    });

    // Step 3: React to external event
    await step.do('mark-paid', { ... }, async () => {
      return withDb(this.env, async (sql) => {
        const handler = markOrderPaidHandler(sql);
        await handler.handle({ kind: 'MarkOrderPaidCommand', ... });
        return { status: 'paid' };
      });
    });

    return { /* final result */ };
  }
}
```

### Workflow Rules

1. **Re-export from server.ts**: `export { PaymentWorkflow } from './application/workflows/paymentWorkflow';`
2. **Configure in wrangler.jsonc**:
   ```jsonc
   "workflows": [{
     "name": "my-workflow",
     "binding": "MY_WORKFLOW",
     "class_name": "PaymentWorkflow"
   }]
   ```
3. **Step idempotency**: DCB deciders handle retries naturally (duplicate = no-op)
4. **step.do()**: for command handler calls with retries
5. **step.waitForEvent()**: for external signals (webhooks, etc.)
6. **Serializable returns**: step results must be JSON-serializable

## 8. Server Entrypoint (`src/server.ts`)

```typescript
import handler from '@tanstack/react-start/server-entry';

export default {
	fetch: handler.fetch,
};

// Re-export workflow classes — Cloudflare requires it from the entrypoint
export { PaymentWorkflow } from './application/workflows/paymentWorkflow';
```

## 9. Project Config Files

### package.json (key dependencies)

```json
{
	"type": "module",
	"imports": { "#/*": "./src/*" },
	"dependencies": {
		"@cloudflare/vite-plugin": "^1.13.8",
		"@fraktalio/fmodel-decider": "jsr:^0.9.0",
		"@tailwindcss/vite": "^4.1.18",
		"@tanstack/react-start": "^1.132.0",
		"@tanstack/react-router": "^1.132.0",
		"@tanstack/router-plugin": "^1.132.0",
		"lucide-react": "^0.545.0",
		"postgres": "^3.4.9",
		"react": "^19.2.0",
		"react-dom": "^19.2.0",
		"tailwindcss": "^4.1.18"
	}
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
	plugins: [
		devtools(),
		cloudflare({ viteEnvironment: { name: 'ssr' } }),
		tsconfigPaths({ projects: ['./tsconfig.json'] }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});
```

### wrangler.jsonc

```jsonc
{
	"name": "my-app",
	"compatibility_date": "2025-09-02",
	"compatibility_flags": ["nodejs_compat"],
	"main": "src/server.ts",
	"observability": { "enabled": true },
	"upload_source_maps": true,
	"workflows": [
		{ "name": "my-workflow", "binding": "MY_WORKFLOW", "class_name": "PaymentWorkflow" },
	],
	"hyperdrive": [
		{
			"binding": "HYPERDRIVE",
			"id": "<your-hyperdrive-id>",
			"localConnectionString": "postgres://user:password@localhost:5432/postgres",
		},
	],
}
```

### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:17-alpine
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./src/infrastructure/dcb_schema.sql:/docker-entrypoint-initdb.d/01-dcb_schema.sql:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U user -d postgres']
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

### DCB Schema

The full DCB schema is in `src/infrastructure/dcb_schema.sql`. It provides:

- `dcb.events` table — primary event storage
- `dcb.event_tags` table — tag index for fast lookups
- `dcb.conditional_append()` — atomic conflict check + append
- `dcb.select_events_by_tags()` — tag-based event loading
- `dcb.select_last_events_by_tags()` — last-event-only loading

Copy the schema file as-is for new projects. It's auto-applied by Docker Compose
on first boot.
