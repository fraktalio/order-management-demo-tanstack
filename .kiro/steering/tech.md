# Tech Stack

## Core Framework

- **TanStack Start** (v1.132+) — full-stack React framework with SSR, server functions, and file-based routing
- **TanStack Router** (v1.132+) — type-safe file-based routing
- **React 19** with react-dom
- **[fmodel-decider](https://github.com/fraktalio/fmodel-decider)** (`@fraktalio/fmodel-decider`) — event sourcing with Dynamic Consistency Boundary (DCB) pattern. Provides `DcbDecider`, `EventSourcedCommandHandler`, `EventSourcedQueryHandler`, `PostgresEventRepository`, and Given/When/Then test DSL

## Styling

- **Tailwind CSS v4** — utility-first CSS via `@tailwindcss/vite` plugin
- Global styles in `src/styles.css` (imports Tailwind via `@import "tailwindcss"`)

## Icons

- **lucide-react** — icon library

## Build & Tooling

- **Vite 7** — build tool and dev server
- **TypeScript 5.7+** — strict mode enabled, bundler module resolution
- **pnpm** — package manager

## Deployment

- **Cloudflare Workers** — runtime target via `@cloudflare/vite-plugin`
- **Wrangler** — Cloudflare CLI for dev, deploy, and type generation
- **Cloudflare Workflows** — durable multi-step execution with retries, persistent state, and `waitForEvent` for external signals. Binding: `MY_WORKFLOW`. `PaymentWorkflow` wraps `PlaceOrderCommand` + `MarkOrderPaidCommand`/`MarkOrderPaymentFailedCommand` into a single workflow
- **Hyperdrive** — Postgres connection pooling and caching, configured in `wrangler.jsonc`

## Database

- **Postgres.js** (`postgres`) — Postgres driver (replaces `pg` to avoid unhandled socket errors)
- `src/infrastructure/db.ts` exports `withDb(env, fn)` — handles connection creation, cleanup, and error wrapping
- Uses `env.HYPERDRIVE.connectionString` for both local dev and production
- **Docker Compose** (`docker-compose.yml`) — local Postgres with auto-applied DCB schema

## Code Formatting

- **Prettier** — code formatter with `prettier-plugin-tailwindcss` for Tailwind class sorting
- `pnpm format` to format, `pnpm format:check` to verify

## Testing

- **Vitest** — test runner
- **Testing Library** (React + DOM) — component testing
- **jsdom** — DOM environment for tests

## Dev Tools

- `@tanstack/react-devtools` and `@tanstack/react-router-devtools` — enabled in dev

## Path Aliases

- `@/*` maps to `./src/*` (tsconfig paths)
- `#/*` maps to `./src/*` (package.json imports)

## Common Commands

| Command             | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `pnpm dev`          | Start dev server on port 3000                                  |
| `pnpm build`        | Production build via Vite                                      |
| `pnpm preview`      | Build + preview locally                                        |
| `pnpm test`         | Run tests with Vitest (single run)                             |
| `pnpm deploy`       | Build + deploy to Cloudflare Workers                           |
| `pnpm cf-typegen`   | Generate Cloudflare Worker types (`worker-configuration.d.ts`) |
| `pnpm format`       | Format all files with Prettier                                 |
| `pnpm format:check` | Check formatting without writing                               |
