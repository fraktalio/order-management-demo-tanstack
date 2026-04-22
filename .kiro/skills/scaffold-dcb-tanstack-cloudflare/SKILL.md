---
name: scaffold-dcb-tanstack-cloudflare
description: >
  Scaffold a full-stack event-sourced application using TanStack Start,
  Cloudflare Workers, and the fmodel-decider DCB pattern backed by PostgreSQL
  via Hyperdrive. Use when the user wants to create a new project or add new
  domain use cases (commands, events, views, workflows) following the DCB
  architecture. Handles project setup, domain modeling, infrastructure wiring,
  UI pages, and testing with Given/When/Then specs.
license: Apache 2.0
compatibility: >
  Requires Node.js 20+, pnpm, Docker (for local Postgres), and a Cloudflare
  account for deployment. Uses TanStack Start v1.132+, React 19, Vite 7,
  Tailwind CSS v4, and @fraktalio/fmodel-decider from JSR.
metadata:
  author: fraktalio
  version: '1.0.0'
  framework: tanstack-start
  runtime: cloudflare-workers
  pattern: dcb-event-sourcing
  example-repo: https://github.com/fraktalio/order-management-demo-tanstack
---

# Scaffold DCB + TanStack Start + Cloudflare Workers

Scaffold or extend a full-stack event-sourced application using the Dynamic
Consistency Boundary (DCB) pattern with TanStack Start on Cloudflare Workers.

Full working example:
[order-management-demo-tanstack](https://github.com/fraktalio/order-management-demo-tanstack)

## When to Use

- Creating a new full-stack project with event sourcing and DCB
- Adding new domain use cases (commands, events, deciders, views) to an existing project
- Wiring domain logic through the application layer (command/query handlers, repositories)
- Adding Cloudflare Workflows for multi-step orchestration (sagas, process managers)
- Creating UI pages with TanStack Start server functions
- Setting up infrastructure (Postgres, Hyperdrive, Docker, Wrangler)

## Overview

The architecture follows a strict layered structure:

```
domain/        → Pure logic: deciders, views, types, errors (no deps)
application/   → Wiring: command handlers, query handlers, workflows
infrastructure/→ Persistence: repositories, DB helpers, SQL schema
routes/        → UI pages + REST API endpoints
```

Each layer depends only on the layers below it. The domain layer has zero
infrastructure dependencies — it's pure TypeScript functions and types.

## Step-by-Step Instructions

### Step 1: Gather Requirements

Ask the user for:

1. **Project name** (if new project) or confirm extending existing
2. **Domain use cases** — what commands should the system handle?
3. **Events** — what facts does each command produce?
4. **Read models** — what views/projections are needed?
5. **Workflows** — any multi-step orchestrations needed?
6. **Pages** — what UI pages are needed?

If the user provides an Event Model diagram (image), use the
`map-event-model-to-code` skill first to extract the table, then continue here.

### Step 2: Scaffold Project (New Project Only)

If creating a new project, generate these files in order:

1. `package.json` — dependencies and scripts
2. `tsconfig.json` — TypeScript config with path aliases
3. `vite.config.ts` — Vite + Cloudflare + Tailwind + TanStack
4. `wrangler.jsonc` — Cloudflare Workers config with Hyperdrive
5. `docker-compose.yml` — local Postgres with DCB schema auto-apply
6. `.prettierrc` + `.prettierignore` — formatting config
7. `src/styles.css` — Tailwind v4 entry point
8. `src/infrastructure/dcb_schema.sql` — PostgreSQL DCB schema
9. `src/infrastructure/db.ts` — `withDb(env, fn)` helper
10. `src/infrastructure/pg-client-adapter.ts` — postgres.js → SqlClient adapter
11. `src/server.ts` — Cloudflare Worker entrypoint
12. `src/router.tsx` — TanStack Router factory
13. `src/routes/__root.tsx` — root layout

See [references/INFRASTRUCTURE-PATTERNS.md](references/INFRASTRUCTURE-PATTERNS.md)
for exact templates.

### Step 3: Define Domain Types (`src/domain/api.ts`)

For each use case, generate in `src/domain/api.ts`:

1. **Branded type IDs** — one per unique entity ID
2. **Domain errors** — one per validation/invariant failure
3. **Value objects** — shared types (names, statuses, menus, etc.)
4. **Command types** — discriminated union with `kind` field
5. **Event types** — using `TypeSafeEventShape` with `tagFields`

See [references/DOMAIN-PATTERNS.md](references/DOMAIN-PATTERNS.md) for the
exact type patterns and conventions.

### Step 4: Implement Deciders (`src/domain/deciders/`)

For each command, create a decider file:

1. Define the **state type** — minimal state needed for validation
2. Create the `DcbDecider<C, S, Ei, Eo>` with:
   - `decide(command, state)` — validation + event production
   - `evolve(state, event)` — state reconstruction from events
   - `initialState` — starting state value
3. Determine **Ei** (input events) from what the decider needs to read
4. Determine **Eo** (output events) from what the decider produces
5. Make idempotent commands return `[]` (no events) on duplicates

See [references/DOMAIN-PATTERNS.md](references/DOMAIN-PATTERNS.md) for decider
patterns.

### Step 5: Implement Views (`src/domain/views/`)

For each read model, create a view file:

1. Define the **view state type** — denormalized read model shape
2. Define the **event union type** — events this view subscribes to
3. Create the `Projection<S | null, E>` with:
   - `evolve(state, event)` — fold events into state
   - `initialState` — `null`
4. Use exhaustive `switch` with `never` check in default branch

See [references/DOMAIN-PATTERNS.md](references/DOMAIN-PATTERNS.md) for view
patterns.

### Step 6: Write Tests

For each decider, create a co-located `.test.ts` file using Given/When/Then:

```typescript
import { DeciderEventSourcedSpec } from '../test-specs.ts';
spec
	.given([...events])
	.when(command)
	.then([...expectedEvents]);
spec
	.given([...events])
	.when(command)
	.thenThrows((e) => e instanceof SomeError);
```

For each view, create a co-located `.test.ts` file using Given/Then:

```typescript
import { ViewSpecification } from '../test-specs.ts';
spec.given([...events]).then(expectedState);
```

Create shared fixtures in `src/domain/fixtures.ts`.

### Step 7: Wire Infrastructure

For each decider, create:

1. **Repository** (`src/infrastructure/repositories/`) — `PostgresEventRepository`
   with query tuples mapping command fields to `(tag, eventType)` pairs
2. **Command handler** (`src/application/command-handlers/`) —
   `EventSourcedCommandHandler(decider, repository)`

For each view, create:

1. **Query handler** (`src/application/query-handlers/`) —
   `EventSourcedQueryHandler(view, PostgresEventLoader)`

See [references/INFRASTRUCTURE-PATTERNS.md](references/INFRASTRUCTURE-PATTERNS.md)
for exact patterns.

### Step 8: Create Routes

For UI pages, create files in `src/routes/`:

1. Define `createServerFn` functions that call handlers via `withDb(env, ...)`
2. Create the route with `createFileRoute`
3. Build React components with Tailwind CSS styling

For REST API endpoints, create files in `src/routes/api/`:

1. Use `server.handlers` with HTTP method handlers
2. Parse request body, call `handleCommand(fn)` wrapper

See [references/UI-PATTERNS.md](references/UI-PATTERNS.md) for route patterns.

### Step 9: Add Workflows (Optional)

For multi-step orchestrations:

1. Create a `WorkflowEntrypoint` class in `src/application/workflows/`
2. Use `step.do()` for each command handler call (with retries)
3. Use `step.waitForEvent()` for external signals
4. Re-export the class from `src/server.ts`
5. Add the workflow binding to `wrangler.jsonc`

See [references/INFRASTRUCTURE-PATTERNS.md](references/INFRASTRUCTURE-PATTERNS.md)
for workflow patterns.

### Step 10: Update Barrel Exports

Update `src/domain/index.ts`, `src/infrastructure/index.ts`, and
`src/application/index.ts` to export new artifacts.

## Key Conventions

- **File naming**: `camelCase.ts` for all source files
- **Test naming**: `camelCase.test.ts` co-located with source
- **Decider naming**: `{useCaseName}Decider` (e.g., `createRestaurantDecider`)
- **View naming**: `{entityName}View` (e.g., `orderView`)
- **Handler naming**: `{useCaseName}Handler` (e.g., `createRestaurantHandler`)
- **Repository naming**: `{useCaseName}Repository` (e.g., `createRestaurantRepository`)
- **Command kind**: `PascalCaseCommand` (e.g., `CreateRestaurantCommand`)
- **Event kind**: `PascalCaseEvent` (e.g., `RestaurantCreatedEvent`)
- **Error naming**: `PascalCaseError extends DomainError`
- **Branded IDs**: `type FooId = Brand<string, 'FooId'>` with factory `fooId(s)`
- **tagFields**: declare which string ID fields should be indexed
- **Tags in repositories**: `"fieldName:" + value` format (e.g., `"restaurantId:" + cmd.restaurantId`)
- **Idempotency**: duplicate commands return `[]` (empty events), never throw
- **Imports**: use `@/` path alias for `src/`, `.ts` extensions in relative imports
