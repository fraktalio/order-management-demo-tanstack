# UI & Route Patterns Reference

## 1. Root Layout (`src/routes/__root.tsx`)

```typescript
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';

import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        <Header />
        {children}
        <Scripts />
      </body>
    </html>
  );
}
```

## 2. Page Routes with Server Functions

Page routes use `createServerFn` to call domain handlers directly — no
intermediate REST calls.

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { useState } from 'react';
import { withDb } from '@/infrastructure/db';
import { createRestaurantHandler } from '@/application/command-handlers/createRestaurant.ts';
import { restaurantId, restaurantMenuId, menuItemId } from '@/domain/api.ts';

// ─── Server Functions ───────────────────────────────────────────────

type CreateRestaurantInput = {
  restaurantId: string;
  name: string;
  menuItems: { name: string; price: string }[];
};

const createRestaurant = createServerFn({ method: 'POST' })
  .inputValidator((input: CreateRestaurantInput) => input)
  .handler(async ({ data }) => {
    return withDb(env, (sql) => {
      const handler = createRestaurantHandler(sql);
      return handler.handle({
        kind: 'CreateRestaurantCommand',
        restaurantId: restaurantId(data.restaurantId || crypto.randomUUID()),
        name: data.name,
        menu: { /* ... */ },
      });
    });
  });

// ─── Route ──────────────────────────────────────────────────────────

export const Route = createFileRoute('/restaurant')({
  component: RestaurantPage,
});

// ─── Page ───────────────────────────────────────────────────────────

function RestaurantPage() {
  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <div className="mx-auto max-w-3xl">
        {/* Page content */}
      </div>
    </div>
  );
}
```

### Server Function Pattern

```typescript
const myServerFn = createServerFn({ method: 'POST' })
	.inputValidator((input: MyInputType) => input)
	.handler(async ({ data }) => {
		return withDb(env, (sql) => {
			const handler = myCommandHandler(sql);
			return handler.handle({ kind: 'MyCommand', ...data });
		});
	});
```

Key points:

- Import `env` from `'cloudflare:workers'` at module level
- Use `withDb(env, sql => ...)` for database access
- `inputValidator` provides type-safe input
- Server functions are called from client components like regular async functions

### Query Server Function Pattern

```typescript
const fetchRestaurant = createServerFn({ method: 'POST' })
	.inputValidator((input: string) => input)
	.handler(async ({ data: rid }) => {
		return withDb(env, (sql) => {
			const handler = restaurantQueryHandler(sql);
			return handler.handle([
				['restaurantId:' + rid, 'RestaurantCreatedEvent'],
				['restaurantId:' + rid, 'RestaurantMenuChangedEvent'],
			]);
		});
	});
```

### Ad-hoc Query Pattern (direct event loading)

For queries that don't fit a single view, load events directly:

```typescript
const fetchAllOrders = createServerFn({ method: 'POST' }).handler(async () => {
	return withDb(env, async (sql) => {
		const rows = await sql.unsafe<{ data: Buffer }[]>(
			`SELECT e.data FROM dcb.events e
       WHERE e.type IN ('RestaurantOrderPlacedEvent', 'OrderPaidEvent', ...)
       ORDER BY e.id ASC`,
		);
		const map = new Map<string, OrderViewState>();
		for (const row of rows) {
			const event = JSON.parse(Buffer.from(row.data).toString('utf-8'));
			const oid = event.orderId as string;
			const current = map.get(oid) ?? orderView.initialState;
			const next = orderView.evolve(current, event);
			if (next) map.set(oid, next);
		}
		return Array.from(map.values());
	});
});
```

## 3. REST API Routes (`src/routes/api/`)

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { withDb } from '@/infrastructure/db';
import { handleCommand } from '@/application/index.ts';
import { createRestaurantHandler } from '@/application/command-handlers/createRestaurant.ts';
import { restaurantId } from '@/domain/api.ts';
import type { CreateRestaurantCommand } from '@/domain/api.ts';

export const Route = createFileRoute('/api/restaurants')({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = (await request.json()) as {
					restaurantId?: string;
					name: string;
					menu: CreateRestaurantCommand['menu'];
				};
				return handleCommand(() =>
					withDb(env, (sql) => {
						const handler = createRestaurantHandler(sql);
						return handler.handle({
							kind: 'CreateRestaurantCommand',
							restaurantId: restaurantId(body.restaurantId ?? crypto.randomUUID()),
							name: body.name,
							menu: body.menu,
						});
					}),
				);
			},
		},
	},
});
```

### API Route with URL Params

```typescript
export const Route = createFileRoute('/api/restaurants/$restaurantId/menu')({
	server: {
		handlers: {
			PUT: async ({ request, params }) => {
				const body = (await request.json()) as { menu: ChangeRestaurantMenuCommand['menu'] };
				return handleCommand(() =>
					withDb(env, (sql) => {
						const handler = changeRestaurantMenuHandler(sql);
						return handler.handle({
							kind: 'ChangeRestaurantMenuCommand',
							restaurantId: restaurantId(params.restaurantId),
							menu: body.menu,
						});
					}),
				);
			},
		},
	},
});
```

File naming for parameterized routes:

- `restaurants.$restaurantId.menu.ts` → `/api/restaurants/:restaurantId/menu`
- `orders.$orderId.prepare.ts` → `/api/orders/:orderId/prepare`

## 4. Workflow UI Pattern

For pages that interact with Cloudflare Workflows:

```typescript
// Start a workflow
const startWorkflow = createServerFn({ method: 'POST' })
	.inputValidator((input: WorkflowParams) => input)
	.handler(async ({ data }) => {
		const instance = await env.MY_WORKFLOW.create({ params: data });
		return { instanceId: instance.id };
	});

// Check workflow status
const getStatus = createServerFn({ method: 'POST' })
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		const instance = await env.MY_WORKFLOW.get(id);
		const status = await instance.status();
		return { status: status.status, output: status.output };
	});

// Send event to workflow
const sendEvent = createServerFn({ method: 'POST' })
	.inputValidator((input: { instanceId: string; payload: EventPayload }) => input)
	.handler(async ({ data }) => {
		const instance = await env.MY_WORKFLOW.get(data.instanceId);
		await instance.sendEvent({ type: 'event-type', payload: data.payload });
		return { sent: true };
	});
```

Client-side polling pattern:

```typescript
const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

const startPolling = (id: string) => {
	stopPolling();
	pollRef.current = setInterval(async () => {
		const res = await getStatus({ data: id });
		setWorkflowStatus(res);
		if (['complete', 'errored', 'terminated'].includes(res.status)) stopPolling();
	}, 2000);
};

useEffect(() => () => stopPolling(), []);
```

## 5. Styling Conventions

- Dark theme: `bg-slate-900`, `text-white`, `border-slate-700`
- Accent color: `cyan-400`/`cyan-500` for interactive elements
- Cards: `rounded-lg border border-slate-700 bg-slate-800/50 p-4`
- Buttons: `rounded-lg bg-cyan-500 px-6 py-2 font-semibold hover:bg-cyan-600`
- Status badges: `rounded-full px-2 py-0.5 text-xs font-semibold`
- Page layout: `min-h-screen bg-slate-900 p-8 text-white` with `mx-auto max-w-3xl`
- Icons from `lucide-react`: `<IconName className="h-8 w-8 text-cyan-400" />`

## 6. Router (`src/router.tsx`)

```typescript
import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: 'intent',
		defaultPreloadStaleTime: 0,
	});
	return router;
}

declare module '@tanstack/react-router' {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
```

## 7. Navigation Header (`src/components/Header.tsx`)

The header uses a slide-out sidebar navigation with `Link` components from
`@tanstack/react-router`. Each link uses `activeProps` for active state styling.

When adding new pages, add a corresponding `Link` in the Header component.
