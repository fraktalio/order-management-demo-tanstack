# Restaurant Order Management — TanStack Start (TypeScript) Demo

A restaurant and order management demo built with
[TanStack Start](https://tanstack.com/start), deployed to
[Cloudflare Workers](https://developers.cloudflare.com/workers/) via
[`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/frameworks/framework-guides/tanstack-start/),
showcasing the **Dynamic Consistency Boundary (DCB)** pattern from
[`fmodel-decider`](https://jsr.io/@fraktalio/fmodel-decider).
[PostgreSQL](https://www.postgresql.org/) serves as the event store, accessed
through [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
for connection pooling and low-latency queries — with the DCB schema providing
tag-based indexing and optimistic concurrency via `conditional_append`.

![Home](home.png)

## Event Modeling

The domain is designed using [Event Modeling](https://eventmodeling.org) — a
blueprint that maps out commands, events, read models, and UI interactions in a
single visual artifact.

![Event Modeling Blueprint](f1.png)

## Tech Stack

| Layer     | Technology                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------- |
| Runtime   | [Cloudflare Workers](https://developers.cloudflare.com/workers/) (edge)                                   |
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, SSR, file-based routing, server functions)        |
| Styling   | [Tailwind CSS v4](https://tailwindcss.com) via `@tailwindcss/vite`                                        |
| Database  | [PostgreSQL](https://www.postgresql.org/) via [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) |
| Driver    | [Postgres.js](https://github.com/porsager/postgres) (`postgres`)                                          |
| Domain    | [`@fraktalio/fmodel-decider`](https://jsr.io/@fraktalio/fmodel-decider) (DCB pattern)                     |
| Build     | [Vite 7](https://vite.dev) + `@cloudflare/vite-plugin`                                                    |
| Testing   | [Vitest](https://vitest.dev), Given/When/Then specs                                                       |
| Icons     | [lucide-react](https://lucide.dev)                                                                        |

## Dynamic Consistency Boundary (DCB)

Unlike the traditional aggregate pattern, DCB defines consistency boundaries
**per use case** rather than per entity. Each decider focuses on a single
command and declares exactly which events it needs to make its decision.

`DcbDecider<Command, State, InputEvent, OutputEvent>` distinguishes between
input events (what the decider reads to build state) and output events (what it
produces) at the type level. This means the compiler enforces that `decide` only
returns output events and `evolve` handles all input events — making pattern
matching exhaustive and the entire pipeline type-safe.

### Use-Case Deciders

| Decider                       | Command                       | Reads                                                                                | Produces                     |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------ | ---------------------------- |
| `createRestaurantDecider`     | `CreateRestaurantCommand`     | `RestaurantCreatedEvent`                                                             | `RestaurantCreatedEvent`     |
| `changeRestaurantMenuDecider` | `ChangeRestaurantMenuCommand` | `RestaurantCreatedEvent`, `RestaurantMenuChangedEvent`                               | `RestaurantMenuChangedEvent` |
| `placeOrderDecider`           | `PlaceOrderCommand`           | `RestaurantCreatedEvent`, `RestaurantMenuChangedEvent`, `RestaurantOrderPlacedEvent` | `RestaurantOrderPlacedEvent` |
| `markOrderAsPreparedDecider`  | `MarkOrderAsPreparedCommand`  | `RestaurantOrderPlacedEvent`, `OrderPreparedEvent`                                   | `OrderPreparedEvent`         |

Notice how `placeOrderDecider` spans both Restaurant and Order concepts —
something that's natural in DCB but would require a saga or process manager in
the aggregate pattern.

### Event Repository (PostgreSQL)

A production-ready event-sourced repository using PostgreSQL with optimistic
locking, flexible querying, and type-safe tag-based indexing.

The storage layout uses the `dcb` schema with these structures:

| Structure                    | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| `dcb.events`                 | Primary event storage (id, type, data as bytea, tags, created_at)     |
| `dcb.event_tags`             | Tag index — maps `(tag, event_id)` for fast tag-based lookups         |
| `conditional_append`         | Atomic conflict check + append with optimistic locking via `after_id` |
| `select_events_by_tags`      | Full-replay event loading by tag-based query tuples                   |
| `select_last_events_by_tags` | Idempotent (last-event) loading per query group                       |

Event data is stored once as bytea; the `event_tags` table provides secondary
indexing. The repository automatically extracts tags from event `tagFields`
in `"fieldName:value"` format, enabling flexible querying by any combination
of tag fields. Optimistic locking uses an integer `after_id` (the max event id
at load time) instead of versionstamps.

### Sliced / Vertical Repositories

Each decider has its own repository that declares exactly which event types it
needs, queried by the relevant entity IDs. This is the **sliced** (or vertical)
approach — instead of loading all events for an aggregate, each use case loads
only the minimal slice required for its decision:

```
createRestaurant       → [("restaurantId:<id>", "RestaurantCreatedEvent")]
changeRestaurantMenu   → [("restaurantId:<id>", "RestaurantCreatedEvent"),
                          ("restaurantId:<id>", "RestaurantMenuChangedEvent")]
placeOrder             → [("restaurantId:<id>", "RestaurantCreatedEvent"),
                          ("restaurantId:<id>", "RestaurantMenuChangedEvent"),
                          ("orderId:<id>",      "RestaurantOrderPlacedEvent")]
markOrderAsPrepared    → [("orderId:<id>",      "RestaurantOrderPlacedEvent"),
                          ("orderId:<id>",      "OrderPreparedEvent")]
```

Notice how `placeOrder` spans two entity IDs (`restaurantId` and `orderId`) to
validate menu items against the restaurant while checking order uniqueness — a
cross-entity consistency boundary that would require coordination in the
aggregate pattern but is just a wider tuple query here.

Each tuple `("tag", "eventType")` maps to a PostgreSQL tag-based query via
`dcb.select_events_by_tags`, so the repository fetches only the matching events
with no full-stream scanning. The result: every use case pays only for the
events it actually reads, and adding a new use case never widens the query of
an existing one.

```ts
// Wire a decider to its sliced repository and handle a command
const repository = createRestaurantRepository(sql);
const handler = new EventSourcedCommandHandler(createRestaurantDecider, repository);
const events = await handler.handle(createRestaurantCommand);
```

## Specification by Example (Given/When/Then)

Deciders are tested using a **Given/When/Then** format powered by
`DeciderEventSourcedSpec`. This makes tests read like executable specifications:

```ts
test('Place Order - Success', () => {
	DeciderEventSourcedSpec.for(placeOrderDecider)
		.given([
			{
				kind: 'RestaurantCreatedEvent',
				restaurantId: restaurantId('restaurant-1'),
				name: 'Italian Bistro',
				menu: testMenu,
				final: false,
				tagFields: ['restaurantId'],
			},
		])
		.when({
			kind: 'PlaceOrderCommand',
			restaurantId: restaurantId('restaurant-1'),
			orderId: orderId('order-1'),
			menuItems: testMenuItems,
		})
		.then([
			{
				kind: 'RestaurantOrderPlacedEvent',
				restaurantId: restaurantId('restaurant-1'),
				orderId: orderId('order-1'),
				menuItems: testMenuItems,
				final: false,
				tagFields: ['restaurantId', 'orderId'],
			},
		]);
});
```

Error scenarios use `.thenThrows()`:

```ts
DeciderEventSourcedSpec.for(placeOrderDecider)
	.given([])
	.when(placeOrderCommand)
	.thenThrows((error) => error instanceof RestaurantNotFoundError);
```

## Views (Ad-hoc / Live Read Models)

Views are pure `Projection` functions that fold events into denormalized
read-model state. Two views exist — `orderView` and `restaurantView` — each
handling only the events it cares about, with exhaustive pattern matching.

At runtime, an `EventSourcedQueryHandler` wires a view to PostgreSQL via
`PostgresEventLoader`, building the projection on demand from stored events (no
separate read database needed).

Views are tested with a **Given/Then** format using `ViewSpecification`:

```ts
test('Order View - Order Prepared Event', () => {
	ViewSpecification.for(orderView)
		.given([
			{
				kind: 'RestaurantOrderPlacedEvent',
				orderId: orderId('order-1'),
				restaurantId: restaurantId('restaurant-1'),
				menuItems: testMenuItems,
				final: false,
				tagFields: ['restaurantId', 'orderId'],
			},
			{
				kind: 'OrderPreparedEvent',
				orderId: orderId('order-1'),
				final: false,
				tagFields: ['orderId'],
			},
		])
		.then({
			orderId: orderId('order-1'),
			restaurantId: restaurantId('restaurant-1'),
			menuItems: testMenuItems,
			status: 'PREPARED',
		});
});
```

## Cloudflare Workflows

[Cloudflare Workflows](https://developers.cloudflare.com/workflows/) provide
durable, multi-step execution with automatic retries, persistent state, and the
ability to pause and wait for external events. They are a powerful primitive for
orchestrating complex flows — common patterns include **Sagas** and **Process
Managers**, where a long-running process coordinates multiple commands, reacts
to external signals, and handles compensating actions on failure.

![Workflow](workflow.png)

This demo includes a `PaymentWorkflow` that orchestrates the full
order-to-payment lifecycle:

1. **Place Order** — calls the `placeOrderHandler` to persist the order via
   event sourcing
2. **Await Payment** — pauses with `step.waitForEvent` until a payment
   confirmation (or rejection) arrives from a dummy payment gateway
3. **Process Payment** — validates the payment result; fails the workflow on
   declined payments
4. **Mark Order Prepared** — on successful payment, calls
   `markOrderAsPreparedHandler` to complete the order

The workflow uses `waitForEvent` with a matching event type
(`payment-received`), and the UI sends the event via `instance.sendEvent` —
simulating what an external payment gateway webhook would do in production.

```ts
// src/application/workflows/paymentWorkflow.ts

import { WorkflowEntrypoint, type WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import { withDb } from '@/infrastructure/db';
import { placeOrderHandler } from '@/application/command-handlers/placeOrder';
import { markOrderAsPreparedHandler } from '@/application/command-handlers/markOrderAsPrepared';
import { restaurantId, orderId, menuItemId } from '@/domain/api';

// ─── Workflow Payload Types ─────────────────────────────────────────

export type OrderWorkflowParams = {
	restaurantId: string;
	orderId: string;
	menuItems: { menuItemId: string; name: string; price: string }[];
};

export type PaymentEvent = {
	transactionId: string;
	amount: string;
	status: 'success' | 'failed';
};

// ─── Payment Workflow ───────────────────────────────────────────────

export class PaymentWorkflow extends WorkflowEntrypoint<Env> {
	async run(event: WorkflowEvent<OrderWorkflowParams>, step: WorkflowStep) {
		const { restaurantId: rid, orderId: oid, menuItems } = event.payload;

		// Step 1: Place the order via the domain command handler
		const orderResult = await step.do(
			'place-order',
			{ retries: { limit: 3, delay: '1 second', backoff: 'exponential' }, timeout: '15 seconds' },
			async () => {
				return withDb(this.env, async (sql) => {
					const handler = placeOrderHandler(sql);
					await handler.handle({
						kind: 'PlaceOrderCommand',
						restaurantId: restaurantId(rid),
						orderId: orderId(oid),
						menuItems: menuItems.map((item) => ({
							menuItemId: menuItemId(item.menuItemId),
							name: item.name,
							price: item.price,
						})),
					});
					return { orderId: oid, restaurantId: rid, status: 'placed' };
				});
			},
		);

		// Step 2: Wait for payment confirmation from the dummy payment gateway
		const paymentEvent = await step.waitForEvent<PaymentEvent>('await payment from gateway', {
			type: 'payment-received',
			timeout: '1 hour',
		});

		// Step 3: Process payment result
		const paymentResult = await step.do('process-payment', async () => {
			if (paymentEvent.payload.status !== 'success') {
				throw new Error(`Payment failed — transaction ${paymentEvent.payload.transactionId}`);
			}
			return {
				transactionId: paymentEvent.payload.transactionId,
				amount: paymentEvent.payload.amount,
				status: 'confirmed',
			};
		});

		// Step 4: Mark order as prepared (simulating kitchen auto-confirm after payment)
		await step.do(
			'mark-order-prepared',
			{ retries: { limit: 3, delay: '1 second', backoff: 'exponential' }, timeout: '15 seconds' },
			async () => {
				return withDb(this.env, async (sql) => {
					const handler = markOrderAsPreparedHandler(sql);
					await handler.handle({
						kind: 'MarkOrderAsPreparedCommand',
						orderId: orderId(oid),
					});
					return { orderId: oid, status: 'prepared' };
				});
			},
		);

		return {
			orderId: orderResult.orderId,
			restaurantId: orderResult.restaurantId,
			payment: paymentResult,
			finalStatus: 'prepared',
		};
	}
}
```

Workflows are defined in `src/application/workflows/` and re-exported from
`src/server.ts` (Cloudflare requires workflow classes to be exported from the
Worker entrypoint). The binding is configured in `wrangler.jsonc`.

## Project Structure

```
src/
├── application/              # Use-case orchestration
│   ├── command-handlers/     # EventSourcedCommandHandler per use case
│   ├── query-handlers/       # EventSourcedQueryHandler per view
│   ├── workflows/            # Cloudflare Workflow definitions (Saga / Process Manager)
│   ├── api.ts                # REST API helpers (handleCommand, json)
│   └── index.ts              # Barrel exports
├── domain/                   # Pure domain model (no infrastructure deps)
│   ├── api.ts                # Commands, Events, branded types, errors
│   ├── deciders/             # Pure deciders + co-located tests
│   ├── views/                # Projections + co-located tests
│   ├── fixtures.ts           # Shared test fixtures
│   └── test-specs.ts         # Vitest adapter for fmodel-decider test DSL
├── infrastructure/           # Persistence and external adapters
│   ├── db.ts                 # withDb(env, fn) — Postgres.js connection lifecycle
│   ├── pg-client-adapter.ts  # Adapts postgres.js to fmodel-decider SqlClient
│   ├── dcb_schema.sql        # PostgreSQL DCB schema (run once)
│   └── repositories/         # PostgresEventRepository per use case
├── components/               # Shared React components (Header, etc.)
├── routes/                   # File-based routes (TanStack Router)
│   ├── __root.tsx            # Root layout with sidebar navigation
│   ├── index.tsx             # Home page
│   ├── restaurant.tsx        # Restaurant management (create, change menu)
│   ├── order.tsx             # Order management (place order, track status)
│   ├── kitchen.tsx           # Kitchen dashboard (view orders, mark prepared)
│   ├── workflow.tsx          # Order + Payment workflow (Cloudflare Workflows)
│   └── api/                  # REST API server routes
├── router.tsx                # Router factory
├── server.ts                 # Cloudflare Worker entrypoint
└── styles.css                # Tailwind v4 entry point

docker-compose.yml            # Local Postgres with auto-applied DCB schema
wrangler.jsonc                # Cloudflare Workers + Hyperdrive config
vite.config.ts                # Vite + Cloudflare + Tailwind config
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+) and [pnpm](https://pnpm.io/) installed
- [Docker](https://www.docker.com/) for local PostgreSQL
- A [Cloudflare account](https://dash.cloudflare.com/) (for deployment)

### Setup

1. Clone the repo and install dependencies:

   ```bash
   pnpm install
   ```

2. Start PostgreSQL with the DCB schema:

   ```bash
   docker compose up -d
   ```

   This runs Postgres 17 and auto-applies `src/infrastructure/dcb_schema.sql`
   on first boot. Credentials match `wrangler.jsonc`:
   `postgres://ivan:password@localhost:5432/postgres`

3. Start the dev server:

   ```bash
   pnpm dev
   ```

### Common Commands

```bash
# Development server (port 3000)
pnpm dev

# Production build
pnpm build

# Build + preview locally
pnpm preview

# Run all tests (single run)
pnpm test

# Build + deploy to Cloudflare Workers
pnpm deploy

# Generate Cloudflare Worker types
pnpm cf-typegen

# Format all files with Prettier
pnpm format

# Check formatting without writing
pnpm format:check
```

## Learn More

- [fmodel-decider](https://github.com/fraktalio/fmodel-decider) — DCB pattern library
- [TanStack Start](https://tanstack.com/start) — Full-stack React framework
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — Edge runtime
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/) — Durable multi-step execution
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) — Postgres connection pooling
- [Event Modeling](https://eventmodeling.org) — Design methodology
