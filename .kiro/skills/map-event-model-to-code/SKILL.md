---
name: map-event-model-to-code
description: >
  Two-step skill: (1) Map a visual Event Model diagram (image, Miro board, or
  screenshot) into a Markdown table with cell references, formulas, and a Mermaid
  diagram, then (2) generate TypeScript source files — domain types, DcbDecider
  per command, Projection per view, Given/When/Then tests, infrastructure
  repositories, command/query handlers, and TanStack Start routes — all following
  the DCB pattern with fmodel-decider on Cloudflare Workers. Use when the user
  provides an event modeling image and wants working code.
license: Apache 2.0
compatibility: >
  Requires Node.js 20+, pnpm, @fraktalio/fmodel-decider from JSR, TanStack
  Start, Cloudflare Workers, PostgreSQL via Hyperdrive, Vitest for testing.
metadata:
  author: fraktalio
  version: '1.0.0'
  pattern: dcb-event-sourcing
  example-repo: https://github.com/fraktalio/order-management-demo-tanstack
---

# Map Event Model to Code

A two-step pipeline: visual Event Model diagram → Markdown table → TypeScript
code for TanStack Start + Cloudflare Workers + fmodel-decider.

Full working example:
[order-management-demo-tanstack](https://github.com/fraktalio/order-management-demo-tanstack)

## Step 1: Diagram to Table

See [references/DIAGRAM-TO-TABLE.md](references/DIAGRAM-TO-TABLE.md) for the
full rules on parsing Event Model diagrams into structured tables with formulas
and Mermaid diagrams.

### Quick Summary

Given a visual Event Model diagram with:

- **Commands** (blue sticky notes)
- **Events** (red/orange sticky notes)
- **Projections** (green sticky notes)

Produce:

1. A **Markdown table** with cell references (A1, B1, C2, etc.)
2. **Formulas** showing Command→Event and Event→Projection relationships
3. A **Mermaid diagram** visualizing the flow

### Table Example

|       | A                     | B                  | C                    | D                 | E                |
| ----- | --------------------- | ------------------ | -------------------- | ----------------- | ---------------- |
| Row 1 | C: Create Restaurant  | P: Restaurant [A2] | C: Place Order       | P: Order [C2, C3] | P: Payments [C3] |
| Row 2 | E: Restaurant Created |                    | E: Order Placed      |                   |                  |
| Row 3 |                       |                    | E: Payment Initiated |                   |                  |

### Formulas

```
A1 = C(Create Restaurant)
A2 = E(Restaurant Created)
B1 = P(Restaurant)
C1 = C(Place Order)
C2 = E(Order Placed)
C3 = E(Payment Initiated)
D1 = P(Order)
E1 = P(Payments)

A1 -> [A2]              # Create Restaurant produces Restaurant Created
C1 -> [C2, C3]          # Place Order produces Order Placed, Payment Initiated

B1 <- [A2]              # Restaurant subscribes to Restaurant Created
D1 <- [C2, C3]          # Order subscribes to Order Placed, Payment Initiated
E1 <- [C3]              # Payments subscribes to Payment Initiated
```

## Step 2: Table to Code

### Output Files

For each use case extracted from the table, generate these files:

| Layer          | File                                                                             | What                                   |
| -------------- | -------------------------------------------------------------------------------- | -------------------------------------- |
| Domain types   | `src/domain/api.ts`                                                              | IDs, errors, commands, events, values  |
| Decider        | `src/domain/deciders/{useCaseName}.ts`                                           | DcbDecider per command                 |
| Decider test   | `src/domain/deciders/{useCaseName}.test.ts`                                      | Given/When/Then specs                  |
| View           | `src/domain/views/{entityName}View.ts`                                           | Projection per read model              |
| View test      | `src/domain/views/{entityName}View.test.ts`                                      | Given/Then specs                       |
| Fixtures       | `src/domain/fixtures.ts`                                                         | Shared test data                       |
| Test adapter   | `src/domain/test-specs.ts`                                                       | Vitest adapter for GWT DSL             |
| Repository     | `src/infrastructure/repositories/{useCaseName}.ts`                               | PostgresEventRepository per decider    |
| Cmd handler    | `src/application/command-handlers/{useCaseName}.ts`                              | EventSourcedCommandHandler per decider |
| Query handler  | `src/application/query-handlers/{entityName}Query.ts`                            | EventSourcedQueryHandler per view      |
| Barrel exports | `src/domain/index.ts`, `src/infrastructure/index.ts`, `src/application/index.ts` | Re-exports                             |

### Code Generation Rules

See [references/CODE-GENERATION.md](references/CODE-GENERATION.md) for the
complete code generation rules. Key points below.

#### 1. Shared API (`src/domain/api.ts`)

From the table, generate:

- **Branded type IDs** — one per unique entity ID:

  ```typescript
  import type { TypeSafeEventShape } from '@fraktalio/fmodel-decider';

  type Brand<T, B> = T & { readonly __brand: B };
  export type RestaurantId = Brand<string, 'RestaurantId'>;
  export const restaurantId = (id: string): RestaurantId => id as RestaurantId;
  ```

- **Domain errors** — `DomainError` base + specific subclasses:

  ```typescript
  export class DomainError extends Error {
  	constructor(message: string) {
  		super(message);
  		this.name = this.constructor.name;
  	}
  }
  export class RestaurantAlreadyExistsError extends DomainError {
  	constructor(public readonly restaurantId: RestaurantId) {
  		super(`Restaurant ${restaurantId} already exists`);
  	}
  }
  ```

- **Command types** — discriminated union with `kind`:

  ```typescript
  export type Command = CreateRestaurantCommand | PlaceOrderCommand;
  export type CreateRestaurantCommand = {
  	readonly kind: 'CreateRestaurantCommand';
  	readonly restaurantId: RestaurantId;
  	readonly name: RestaurantName;
  	readonly menu: RestaurantMenu;
  };
  ```

- **Event types** — using `TypeSafeEventShape` with `tagFields`:
  ```typescript
  export type RestaurantCreatedEvent = TypeSafeEventShape<
  	{
  		readonly kind: 'RestaurantCreatedEvent';
  		readonly restaurantId: RestaurantId;
  		readonly name: RestaurantName;
  		readonly menu: RestaurantMenu;
  		readonly final: boolean;
  	},
  	['restaurantId']
  >;
  ```

#### 2. Deciders (`src/domain/deciders/`)

One file per command. Each exports a `DcbDecider<C, S, Ei, Eo>`:

```typescript
import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	type CreateRestaurantCommand,
	RestaurantAlreadyExistsError,
	type RestaurantCreatedEvent,
	type RestaurantId,
} from '../api.ts';

export type CreateRestaurantState = RestaurantId | null;

export const createRestaurantDecider: DcbDecider<
	CreateRestaurantCommand,
	CreateRestaurantState,
	RestaurantCreatedEvent,
	RestaurantCreatedEvent
> = new DcbDecider(
	(command, currentState) => {
		switch (command?.kind) {
			case 'CreateRestaurantCommand':
				if (currentState !== null) {
					throw new RestaurantAlreadyExistsError(command.restaurantId);
				}
				return [
					{
						kind: 'RestaurantCreatedEvent',
						restaurantId: command.restaurantId,
						name: command.name,
						menu: command.menu,
						final: false,
						tagFields: ['restaurantId'],
					},
				];
			default:
				return [];
		}
	},
	(currentState, event) => {
		switch (event?.kind) {
			case 'RestaurantCreatedEvent':
				return event.restaurantId;
			default:
				return currentState;
		}
	},
	null as CreateRestaurantState,
);
```

**Determining types:**

- **Ei** — all events the decider reads to build state (from GWT `Given` lists)
- **Eo** — all events the decider produces (from `decide` return)
- **State** — derive from error scenarios (AlreadyExists → `Id | null`, NotFound → existence, InvalidStatus → status union)
- **tagFields** — ID fields used for tag-based indexing
- **Idempotency** — duplicate commands return `[]`, never throw

#### 3. Views (`src/domain/views/`)

One file per unique projection name:

```typescript
import { Projection } from '@fraktalio/fmodel-decider';
import type { RestaurantCreatedEvent, RestaurantMenuChangedEvent, ... } from '../api.ts';

export type RestaurantEvent = RestaurantCreatedEvent | RestaurantMenuChangedEvent;
export type RestaurantViewState = {
  readonly restaurantId: RestaurantId;
  readonly name: RestaurantName;
  readonly menu: RestaurantMenu;
};

export const restaurantView: Projection<RestaurantViewState | null, RestaurantEvent> =
  new Projection(
    (currentState, event) => {
      switch (event.kind) {
        case 'RestaurantCreatedEvent':
          return { restaurantId: event.restaurantId, name: event.name, menu: event.menu };
        case 'RestaurantMenuChangedEvent':
          return currentState !== null ? { ...currentState, menu: event.menu } : currentState;
        default: {
          // @ts-expect-error exhaustive check
          const _exhaustiveCheck: never = event;
          return currentState;
        }
      }
    },
    null as RestaurantViewState | null,
  );
```

#### 4. Tests (Vitest + Given/When/Then)

**Test adapter** (`src/domain/test-specs.ts`):

```typescript
import { expect } from 'vitest';
import { createSpecs } from '@fraktalio/fmodel-decider';

export const { DeciderEventSourcedSpec, ViewSpecification } = createSpecs({
	assertEquals: <T>(actual: T, expected: T) => expect(actual).toEqual(expected),
	assert: (condition: boolean) => expect(condition).toBeTruthy(),
});
```

**Decider tests** — `describe`/`it` with shared fixtures:

```typescript
import { describe, it } from 'vitest';
import { DeciderEventSourcedSpec as DeciderSpecification } from '../test-specs.ts';
import { createRestaurantDecider } from '../deciders/createRestaurant.ts';
import { RestaurantAlreadyExistsError } from '../api.ts';
import { rId, menu, restaurantCreated } from '../fixtures.ts';

describe('createRestaurantDecider', () => {
	const spec = DeciderSpecification.for(createRestaurantDecider);

	it('creates a restaurant when none exists', () => {
		spec
			.given([])
			.when({ kind: 'CreateRestaurantCommand', restaurantId: rId, name: 'Test Restaurant', menu })
			.then([restaurantCreated]);
	});

	it('throws when restaurant already exists', () => {
		spec
			.given([restaurantCreated])
			.when({ kind: 'CreateRestaurantCommand', restaurantId: rId, name: 'Test Restaurant', menu })
			.thenThrows((e: Error) => e instanceof RestaurantAlreadyExistsError);
	});
});
```

**View tests**:

```typescript
import { describe, it } from 'vitest';
import { ViewSpecification } from '../test-specs.ts';
import { restaurantView } from '../views/restaurantView.ts';
import { rId, menu, restaurantCreated, menuChanged } from '../fixtures.ts';

describe('restaurantView', () => {
	const spec = ViewSpecification.for(restaurantView);
	it('projects restaurant from creation event', () => {
		spec.given([restaurantCreated]).then({ restaurantId: rId, name: 'Test Restaurant', menu });
	});
	it('returns null with no events', () => {
		spec.given([]).then(null);
	});
});
```

#### 5. Infrastructure (Repositories + Handlers)

**Repository** — one per decider:

```typescript
import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';
import type { CreateRestaurantCommand, RestaurantCreatedEvent } from '@/domain/api.ts';

export const createRestaurantRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<
		CreateRestaurantCommand,
		RestaurantCreatedEvent,
		RestaurantCreatedEvent
	>(createSqlClient(sql), (cmd) => [
		['restaurantId:' + cmd.restaurantId, 'RestaurantCreatedEvent'],
	]);
```

Query tuple rules: `['tagField:' + cmd.fieldValue, 'EventKindString']` — one
tuple per `(tag, eventType)` the decider reads.

**Command handler** — one per decider:

```typescript
import type postgres from 'postgres';
import { EventSourcedCommandHandler } from '@fraktalio/fmodel-decider';
import { createRestaurantDecider } from '@/domain/deciders/createRestaurant.ts';
import { createRestaurantRepository } from '@/infrastructure/repositories/createRestaurant.ts';

export const createRestaurantHandler = (sql: postgres.Sql) =>
	new EventSourcedCommandHandler(createRestaurantDecider, createRestaurantRepository(sql));
```

**Query handler** — one per view:

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

#### 6. Naming Conventions

| Artifact        | File Name               | Export Name                      |
| --------------- | ----------------------- | -------------------------------- |
| Decider         | `camelCase.ts`          | `camelCaseDecider`               |
| Decider test    | `camelCase.test.ts`     | —                                |
| View            | `camelCaseView.ts`      | `camelCaseView`                  |
| View test       | `camelCaseView.test.ts` | —                                |
| Shared types    | `api.ts`                | named exports                    |
| Fixtures        | `fixtures.ts`           | named exports                    |
| Repository      | `camelCase.ts`          | `camelCaseRepository`            |
| Command handler | `camelCase.ts`          | `camelCaseHandler`               |
| Query handler   | `camelCaseQuery.ts`     | `camelCaseQueryHandler`          |
| View state type | in view file            | `PascalCaseViewState`            |
| View event type | in view file            | `PascalCaseEvent`                |
| Decider state   | in decider file         | `PascalCaseState` (not exported) |

## Workflow

1. User provides an Event Model diagram (image)
2. Parse diagram → produce table + formulas + Mermaid diagram
3. Confirm table with user before generating code
4. Generate `src/domain/api.ts` (types, commands, events, errors)
5. Generate deciders in `src/domain/deciders/`
6. Generate views in `src/domain/views/`
7. Generate fixtures in `src/domain/fixtures.ts`
8. Generate test-specs adapter in `src/domain/test-specs.ts`
9. Generate tests for deciders and views
10. Generate repositories in `src/infrastructure/repositories/`
11. Generate command handlers in `src/application/command-handlers/`
12. Generate query handlers in `src/application/query-handlers/`
13. Update barrel exports (`index.ts` files)
14. Optionally, invoke `scaffold-dcb-tanstack-cloudflare` skill for routes and workflows
