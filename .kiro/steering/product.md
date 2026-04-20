# Product Overview

A restaurant order management demo built with TanStack Start, deployed to Cloudflare Workers. It demonstrates event sourcing with Dynamic Consistency Boundary (DCB) using the fmodel-decider library, backed by PostgreSQL via Cloudflare Hyperdrive. Includes a Cloudflare Workflow (`PaymentWorkflow`) that wraps `PlaceOrderCommand` and `MarkOrderPaidCommand`/`MarkOrderPaymentFailedCommand` into a single durable, multi-step execution.

## Pages

- **Home** (`/`) — Landing page showcasing the tech stack: event sourcing, DCB, Cloudflare Workers & Workflows, Hyperdrive + PostgreSQL, TanStack Start, and fmodel-decider
- **Restaurant** (`/restaurant`) — Create restaurants with menus, change existing restaurant menus. Uses server functions calling command/query handlers directly
- **Order Workflow** (`/order-workflow`) — Place an order via the `PaymentWorkflow`, await payment gateway event, approve or decline payment. Includes an order tracker to look up any order's current status
- **Kitchen** (`/kitchen`) — Dashboard showing paid orders ready for preparation. Mark paid orders as prepared. Auto-refreshes via polling. Only paid orders can be prepared (enforced by `markOrderAsPreparedDecider`)

## Order Lifecycle

1. **Place Order** — `PlaceOrderCommand` → `RestaurantOrderPlacedEvent` (status: `CREATED`)
2. **Payment** — `MarkOrderPaidCommand` → `OrderPaidEvent` (status: `PAID`) or `MarkOrderPaymentFailedCommand` → `OrderPaymentFailedEvent` (status: `PAYMENT_FAILED`)
3. **Preparation** — `MarkOrderAsPreparedCommand` → `OrderPreparedEvent` (status: `PREPARED`) — only allowed after payment

## Architecture

- **Event Sourcing**: Every state change is stored as an immutable event in the `dcb` schema in PostgreSQL. State is derived by replaying/projecting events
- **Dynamic Consistency Boundary (DCB)**: Tag-based event streams with optimistic concurrency via `conditional_append`. No rigid aggregate boundaries
- **fmodel-decider**: Pure functional domain modeling — deciders for command handling, projections for read-side views, `EventSourcedCommandHandler` and `EventSourcedQueryHandler` for wiring
- **Server Functions**: TanStack Start `createServerFn` calls domain handlers directly via `withDb(env, sql => ...)` — no intermediate REST calls from page routes
- **Cloudflare Workflows**: `PaymentWorkflow` wraps two command handlers (`placeOrder` + `markOrderPaid`/`markOrderPaymentFailed`) into a durable workflow with retries, persistent state, and `waitForEvent` for external payment signals

## Cloudflare Workers

- Pre-configured for Cloudflare Workers via `@cloudflare/vite-plugin`
- Custom server entrypoint (`src/server.ts`) exports Workflows and Workers handlers
- PostgreSQL access via Hyperdrive connection pooling, configured in `wrangler.jsonc`
- `src/infrastructure/db.ts` exports `withDb(env, fn)` — handles connection lifecycle and error wrapping
