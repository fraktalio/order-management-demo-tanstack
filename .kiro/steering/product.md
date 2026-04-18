# Product Overview

A restaurant order management demo built with TanStack Start, deployed to Cloudflare Workers. It demonstrates event sourcing with Dynamic Consistency Boundary (DCB) using the fmodel-decider library, backed by PostgreSQL via Cloudflare Hyperdrive. Includes a Cloudflare Workflow (`PaymentWorkflow`) that orchestrates the full order-to-payment lifecycle.

## Pages

- **Home** (`/`) — Landing page showcasing the tech stack: event sourcing, DCB, Cloudflare Workers & Workflows, Hyperdrive + PostgreSQL, TanStack Start, and fmodel-decider
- **Restaurant** (`/restaurant`) — Create restaurants with menus, change existing restaurant menus. Uses server functions calling command/query handlers directly
- **Order** (`/order`) — Place orders by selecting menu items from a restaurant, track order status by restaurant + order ID
- **Kitchen** (`/kitchen`) — Dashboard showing all orders. Auto-refreshes via polling. Mark orders as prepared. Queries `dcb.events` directly for all order-related events and projects them through the orderView
- **Workflow** (`/workflow`) — Trigger and monitor the `PaymentWorkflow` Cloudflare Workflow (places order → waits for payment → marks prepared)

## Architecture

- **Event Sourcing**: Every state change is stored as an immutable event in the `dcb` schema in PostgreSQL. State is derived by replaying/projecting events
- **Dynamic Consistency Boundary (DCB)**: Tag-based event streams with optimistic concurrency via `conditional_append`. No rigid aggregate boundaries
- **fmodel-decider**: Pure functional domain modeling — deciders for command handling, projections for read-side views, `EventSourcedCommandHandler` and `EventSourcedQueryHandler` for wiring
- **Server Functions**: TanStack Start `createServerFn` calls domain handlers directly via `withDb(env, sql => ...)` — no intermediate REST calls from page routes

## Cloudflare Workers

- Pre-configured for Cloudflare Workers via `@cloudflare/vite-plugin`
- Custom server entrypoint (`src/server.ts`) exports Workflows and Workers handlers
- PostgreSQL access via Hyperdrive connection pooling, configured in `wrangler.jsonc`
- `src/infrastructure/db.ts` exports `withDb(env, fn)` — handles connection lifecycle and error wrapping
