# Architecture Reference

## Layered Architecture

```
src/
├── domain/                # Pure domain model — NO infrastructure dependencies
│   ├── api.ts             # Commands, Events, branded types, errors, value objects
│   ├── deciders/          # One DcbDecider per command (+ co-located tests)
│   ├── views/             # One Projection per read model (+ co-located tests)
│   ├── fixtures.ts        # Shared test fixtures
│   ├── test-specs.ts      # Vitest adapter for GWT test DSL
│   └── index.ts           # Barrel exports
├── application/           # Use-case orchestration — wires domain + infrastructure
│   ├── command-handlers/  # EventSourcedCommandHandler per use case
│   ├── query-handlers/    # EventSourcedQueryHandler per view
│   ├── workflows/         # Cloudflare Workflow entrypoints
│   ├── api.ts             # REST API helpers (handleCommand, json)
│   └── index.ts           # Barrel exports
├── infrastructure/        # Persistence and external adapters
│   ├── db.ts              # withDb(env, fn) — connection lifecycle
│   ├── pg-client-adapter.ts # postgres.js → SqlClient adapter
│   ├── dcb_schema.sql     # PostgreSQL DCB schema
│   ├── repositories/      # PostgresEventRepository per use case
│   └── index.ts           # Barrel exports
├── components/            # Shared React components
├── routes/                # File-based routes (TanStack Router)
│   ├── __root.tsx         # Root layout (shellComponent)
│   ├── index.tsx          # Home page
│   ├── api/               # REST API server routes
│   └── *.tsx              # Page routes
├── router.tsx             # Router factory
├── server.ts              # Cloudflare Worker entrypoint
└── styles.css             # Tailwind v4 entry point
```

## Dynamic Consistency Boundary (DCB) Pattern

Unlike the traditional aggregate pattern, DCB defines consistency boundaries
**per use case** rather than per entity.

### Key Concepts

1. **DcbDecider<C, S, Ei, Eo>** — four type parameters:
   - `C` — Command type (what triggers the decision)
   - `S` — State type (minimal state for validation)
   - `Ei` — Input events (what the decider reads to build state)
   - `Eo` — Output events (what the decider produces)

2. **Tag-based event streams** — events are tagged with entity IDs
   (e.g., `restaurantId:r1`). Repositories query by `(tag, eventType)` tuples.

3. **Optimistic concurrency** — `conditional_append` checks for conflicts
   since the last read (`after_id`), retrying on conflict.

4. **Cross-entity boundaries** — a single decider can span multiple entities
   (e.g., `placeOrderDecider` reads restaurant events AND order events).

### Decider Wiring Flow

```
Command → Repository.load(queryTuples) → events
       → Decider.evolve(initialState, events) → currentState
       → Decider.decide(command, currentState) → newEvents
       → Repository.conditionalAppend(newEvents, afterId)
```

This is handled automatically by `EventSourcedCommandHandler`.

### Query Wiring Flow

```
QueryTuples → PostgresEventLoader.load(tuples) → events
           → View.evolve(initialState, events) → viewState
```

This is handled automatically by `EventSourcedQueryHandler`.

## Tech Stack Summary

| Layer       | Technology                                         |
| ----------- | -------------------------------------------------- |
| Runtime     | Cloudflare Workers (edge)                          |
| Framework   | TanStack Start v1.132+ (React 19, SSR, server fns) |
| Styling     | Tailwind CSS v4 via `@tailwindcss/vite`            |
| Database    | PostgreSQL via Cloudflare Hyperdrive               |
| Driver      | postgres.js (`postgres` npm package)               |
| Domain      | `@fraktalio/fmodel-decider` (DCB pattern)          |
| Build       | Vite 7 + `@cloudflare/vite-plugin`                 |
| Testing     | Vitest + Given/When/Then specs                     |
| Icons       | lucide-react                                       |
| Formatting  | Prettier + prettier-plugin-tailwindcss             |
| Package Mgr | pnpm                                               |

## Dependency Rules

- `domain/` → depends on nothing (only `@fraktalio/fmodel-decider` types)
- `infrastructure/` → depends on `domain/`
- `application/` → depends on `domain/` + `infrastructure/`
- `routes/` → depends on `domain/` + `application/` + `infrastructure/`
- `components/` → depends on nothing (pure React)
