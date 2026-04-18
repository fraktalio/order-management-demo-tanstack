# Project Structure

```
src/
├── application/           # Use-case orchestration (command & query handlers)
│   ├── command-handlers/  # EventSourcedCommandHandler per use case
│   │   ├── createRestaurant.ts
│   │   ├── changeRestaurantMenu.ts
│   │   ├── placeOrder.ts
│   │   └── markOrderAsPrepared.ts
│   ├── query-handlers/    # EventSourcedQueryHandler per view
│   │   ├── restaurantQuery.ts
│   │   └── orderQuery.ts
│   ├── workflows/         # Cloudflare Workflow entrypoints
│   │   └── paymentWorkflow.ts  # PaymentWorkflow — places order, waits for payment, marks prepared
│   ├── api.ts             # REST API helpers (handleCommand, json)
│   └── index.ts
├── domain/                # Pure domain model (fmodel-decider DCB pattern)
│   ├── api.ts             # Commands, Events, branded types, domain errors, value objects
│   ├── deciders/          # Pure decision-making functions (one per use case)
│   │   ├── createRestaurant.ts      (+test)
│   │   ├── changeRestaurantMenu.ts  (+test)
│   │   ├── placeOrder.ts            (+test)
│   │   └── markOrderAsPrepared.ts   (+test)
│   ├── views/             # Event projections for read-side state
│   │   ├── restaurantView.ts  (+test)
│   │   └── orderView.ts       (+test)
│   ├── fixtures.ts        # Shared test fixtures
│   ├── test-specs.ts      # Vitest adapter for fmodel-decider test DSL
│   └── index.ts
├── infrastructure/        # Persistence and external adapters
│   ├── db.ts              # Database helper — withDb(env, fn) wraps Postgres.js connection lifecycle
│   ├── pg-client-adapter.ts  # Wraps postgres.js to match fmodel-decider's SqlClient interface
│   ├── dcb_schema.sql     # PostgreSQL schema for DCB event store (run once against your DB)
│   ├── repositories/      # PostgresEventRepository per use case + combined
│   │   ├── createRestaurant.ts
│   │   ├── changeRestaurantMenu.ts
│   │   ├── placeOrder.ts
│   │   ├── markOrderAsPrepared.ts
│   │   └── all.ts         # AllDeciderRepository (combined, educational)
│   └── index.ts
├── components/            # Shared React components
│   └── Header.tsx         # App header with sidebar navigation
├── lib/                   # Shared utilities and helpers (currently empty)
├── routes/                # File-based routes (TanStack Router)
│   ├── __root.tsx         # Root layout (shellComponent)
│   ├── index.tsx          # Home page (path: "/")
│   ├── restaurant.tsx     # Restaurant management — create restaurant, change menu
│   ├── order.tsx          # Order management — place order, track order status
│   ├── kitchen.tsx        # Kitchen dashboard — view all orders, mark as prepared
│   ├── workflow.tsx       # Workflow trigger page (path: "/workflow")
│   └── api/               # REST API server routes
│       ├── restaurants.ts                      # POST /api/restaurants
│       ├── restaurants.$restaurantId.menu.ts   # PUT  /api/restaurants/:id/menu
│       ├── restaurants.$restaurantId.orders.ts # POST /api/restaurants/:id/orders
│       └── orders.$orderId.prepare.ts          # POST /api/orders/:id/prepare
├── routeTree.gen.ts       # Auto-generated route tree — DO NOT EDIT
├── router.tsx             # Router factory with config
├── server.ts              # Cloudflare Worker entrypoint — exports fetch handler + PaymentWorkflow
└── styles.css             # Global styles (Tailwind v4 import + base overrides)

public/                    # Static assets served as-is
docker-compose.yml         # Local Postgres with auto-applied DCB schema
vite.config.ts             # Vite config
wrangler.jsonc             # Cloudflare Workers config
worker-configuration.d.ts  # Auto-generated CF types — DO NOT EDIT
tsconfig.json              # TypeScript config
```

## Key Conventions

- **Routing**: Add new routes as files in `src/routes/`. TanStack Router auto-generates the route tree. Never edit `src/routeTree.gen.ts` manually.
- **Layout**: The root layout lives in `src/routes/__root.tsx` using `shellComponent`. All pages render inside it.
- **Components**: Shared/reusable components go in `src/components/`.
- **Server entry**: `src/server.ts` is the Cloudflare Worker entrypoint. Re-export Workflow classes (e.g., `PaymentWorkflow`), Durable Objects, queue/cron handlers here.
- **Generated files**: `routeTree.gen.ts` and `worker-configuration.d.ts` are auto-generated. Do not modify them directly.
- **Domain model**: `src/domain/` contains pure domain logic only — deciders, views, types, errors. No infrastructure dependencies.
- **Application layer**: `src/application/` wires deciders + repositories into `EventSourcedCommandHandler` and `EventSourcedQueryHandler` from fmodel-decider. Also contains Cloudflare Workflow entrypoints in `workflows/`.
- **Workflows**: `src/application/workflows/` contains Cloudflare Workflow classes (e.g., `PaymentWorkflow`). These are re-exported from `src/server.ts` as required by Cloudflare.
- **Infrastructure**: `src/infrastructure/` contains Postgres-specific repository implementations, the postgres.js client adapter, the `withDb` helper, and the `dcb_schema.sql`.
- **API routes**: REST endpoints in `src/routes/api/` use TanStack Start server routes. Each calls a command handler via `withDb(env, sql => handler.handle(command))`.
- **Page routes**: HTML page routes (`restaurant.tsx`, `order.tsx`, `kitchen.tsx`) use `createServerFn` to call domain handlers directly — no intermediate REST calls.
- **Tests**: Co-located with source files (e.g., `createRestaurant.test.ts` next to `createRestaurant.ts`). Use Given–When–Then DSL from `test-specs.ts`.
- **Local dev DB**: `docker-compose.yml` runs Postgres 17 and auto-applies `dcb_schema.sql` on first boot. Credentials match `wrangler.jsonc` `localConnectionString`.
