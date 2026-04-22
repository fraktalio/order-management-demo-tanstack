# Code Generation — Full Rules

This reference covers the complete rules for generating TypeScript source files
from an Event Model table. All code targets TanStack Start + Cloudflare Workers
with `@fraktalio/fmodel-decider` from JSR.

## 1. Shared API (`src/domain/api.ts`)

### Branded Type IDs

One branded type per unique entity ID found across all events:

```typescript
import type { TypeSafeEventShape } from '@fraktalio/fmodel-decider';

type Brand<T, B> = T & { readonly __brand: B };

export type RestaurantId = Brand<string, 'RestaurantId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type MenuItemId = Brand<string, 'MenuItemId'>;

export const restaurantId = (id: string): RestaurantId => id as RestaurantId;
export const orderId = (id: string): OrderId => id as OrderId;
export const menuItemId = (id: string): MenuItemId => id as MenuItemId;
```

Rules:

- Type name: `PascalCaseId`
- Factory function: `camelCaseId`
- Always `Brand<string, 'TypeName'>`

### Domain Errors

One `DomainError` base class + specific subclasses derived from invariant
violations:

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

export class RestaurantNotFoundError extends DomainError {
	constructor(public readonly restaurantId: RestaurantId) {
		super(`Restaurant ${restaurantId} does not exist`);
	}
}
```

Common error patterns:

- `{Entity}AlreadyExistsError` — create command when entity exists
- `{Entity}NotFoundError` — update/action command when entity missing
- `{Entity}Already{Status}Error` — action when already in target state
- `{Entity}Not{Status}Error` — action requiring a prerequisite state
- `{Items}NotAvailableError` — validation against related entity data

### Command Types

Discriminated union using `kind` field:

```typescript
export type Command = CreateRestaurantCommand | ChangeRestaurantMenuCommand | PlaceOrderCommand;

export type CreateRestaurantCommand = {
	readonly kind: 'CreateRestaurantCommand';
	readonly restaurantId: RestaurantId;
	readonly name: RestaurantName;
	readonly menu: RestaurantMenu;
};
```

Rules:

- `kind` value matches the type name exactly
- All fields `readonly`
- One type per command from the table (each C cell)

### Event Types

Using `TypeSafeEventShape` with `tagFields`:

```typescript
export type Event =
	| RestaurantCreatedEvent
	| RestaurantMenuChangedEvent
	| RestaurantOrderPlacedEvent;

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

export type RestaurantOrderPlacedEvent = TypeSafeEventShape<
	{
		readonly kind: 'RestaurantOrderPlacedEvent';
		readonly restaurantId: RestaurantId;
		readonly orderId: OrderId;
		readonly menuItems: MenuItem[];
		readonly final: boolean;
	},
	['restaurantId', 'orderId']
>;
```

Rules:

- Import `TypeSafeEventShape` from `@fraktalio/fmodel-decider`
- Second generic parameter lists ID field names for tagging
- Every event has `kind`, `final: boolean`
- Entity-scoped: `['entityId']`
- Cross-entity: `['entityId1', 'entityId2']`
- One type per event from the table (each E cell)

### Value Objects

```typescript
export type RestaurantName = string;
export type MenuItemName = string;
export type OrderStatus = 'NOT_CREATED' | 'CREATED' | 'PAID' | 'PREPARED';

export type MenuItem = {
	readonly menuItemId: MenuItemId;
	readonly name: MenuItemName;
	readonly price: MenuItemPrice;
};
```

## 2. Deciders (`src/domain/deciders/`)

### Mapping Table to Decider

For each `->` formula (Command → Events):

1. **Command type (C)**: the command from the formula
2. **Output events (Eo)**: the events the command produces
3. **Input events (Ei)**: all events needed to build state — includes Eo plus
   any events from other commands that this decider needs to read
4. **State (S)**: minimal state for validation, derived from error scenarios

### Determining Ei (Input Events)

- Start with the output events (Eo)
- Add any events from other deciders that this decider needs to validate against
- Example: `placeOrderDecider` produces `RestaurantOrderPlacedEvent` but also
  reads `RestaurantCreatedEvent` and `RestaurantMenuChangedEvent` to validate
  the restaurant exists and menu items are available

### Determining State

Derive from error scenarios:

- `AlreadyExists` → `EntityId | null` (null = doesn't exist)
- `NotFound` → `EntityId | null` (null = doesn't exist)
- `InvalidStatus` → `{ status: StatusUnion }` with string literal union
- `ValidationError` → track the data being validated (e.g., `menu: Menu | null`)
- Multiple checks → combine into an object type

### Decider Patterns

**Simple existence check:**

```typescript
type State = EntityId | null;
// decide: if (currentState !== null) throw AlreadyExists
// evolve: return event.entityId
// initial: null
```

**Cross-entity validation:**

```typescript
type State = {
	readonly entityId: EntityId | null;
	readonly relatedData: RelatedType | null;
	readonly alreadyDone: boolean;
};
// decide: check entityId, check relatedData, check alreadyDone
// evolve: handle events from multiple entity types
// initial: { entityId: null, relatedData: null, alreadyDone: false }
```

**Status machine:**

```typescript
type Status = 'NOT_FOUND' | 'CREATED' | 'PAID' | 'PREPARED';
type State = { readonly status: Status };
// decide: switch on status, throw or produce events
// evolve: transition status based on event kind
// initial: { status: 'NOT_FOUND' }
```

### Idempotency Rule

Duplicate commands MUST return `[]` (empty array), never throw:

```typescript
case 'PAID':
  return []; // Idempotent: already paid, no-op
```

### tagFields Rule

Events declare which ID fields are indexed:

```typescript
return [
	{
		kind: 'RestaurantOrderPlacedEvent',
		restaurantId: command.restaurantId,
		orderId: command.orderId,
		menuItems: command.menuItems,
		final: false,
		tagFields: ['restaurantId', 'orderId'], // both IDs are tagged
	},
];
```

## 3. Views (`src/domain/views/`)

### Mapping Table to View

For each unique projection name, collect ALL `<-` formulas across the timeline:

1. **Event union**: all events the projection subscribes to
2. **View state**: denormalized read model shape
3. **Initial state**: `null`

### View Pattern

```typescript
import { Projection } from '@fraktalio/fmodel-decider';

export type EntityEvent = EventA | EventB | EventC;

export type EntityViewState = {
	readonly fieldA: TypeA;
	readonly fieldB: TypeB;
	readonly status: StatusType;
};

export const entityView: Projection<EntityViewState | null, EntityEvent> = new Projection(
	(currentState, event) => {
		switch (event.kind) {
			case 'EntityCreatedEvent':
				return {
					/* create state from event fields */
				};
			case 'EntityUpdatedEvent':
				return currentState !== null ? { ...currentState /* update fields */ } : currentState;
			default: {
				// @ts-expect-error exhaustive check
				const _exhaustiveCheck: never = event;
				return currentState;
			}
		}
	},
	null as EntityViewState | null,
);
```

Rules:

- First event creates the state (returns new object)
- Subsequent events update existing state (guard with `!== null`)
- Exhaustive switch with `// @ts-expect-error` + `never` check
- Event union type exported from view file
- State type exported from view file

## 4. Tests

### Test Adapter (`src/domain/test-specs.ts`)

```typescript
import { expect } from 'vitest';
import { createSpecs } from '@fraktalio/fmodel-decider';

export const { DeciderEventSourcedSpec, ViewSpecification } = createSpecs({
	assertEquals: <T>(actual: T, expected: T) => expect(actual).toEqual(expected),
	assert: (condition: boolean) => expect(condition).toBeTruthy(),
});
```

### Fixtures (`src/domain/fixtures.ts`)

Shared test data reused across all test files:

```typescript
import { restaurantId, orderId, menuItemId, restaurantMenuId,
         type RestaurantCreatedEvent, type RestaurantOrderPlacedEvent, ... } from './api.ts';

export const rId = restaurantId('r1');
export const oId = orderId('o1');
export const mId = menuItemId('m1');

export const menu = {
  menuId: restaurantMenuId('rm1'),
  cuisine: 'SERBIAN' as const,
  menuItems: [{ menuItemId: mId, name: 'Ćevapi', price: '12.00' }],
};

export const restaurantCreated: RestaurantCreatedEvent = {
  kind: 'RestaurantCreatedEvent',
  restaurantId: rId,
  name: 'Test Restaurant',
  menu,
  final: false,
  tagFields: ['restaurantId'],
};
```

Rules:

- Short IDs: `r1`, `o1`, `m1`
- One fixture per event type
- Fixtures match what deciders produce
- Reuse across all test files

### Decider Test Pattern

```typescript
import { describe, it } from 'vitest';
import { DeciderEventSourcedSpec as DeciderSpecification } from '../test-specs.ts';

describe('myDecider', () => {
	const spec = DeciderSpecification.for(myDecider);

	it('success case', () => {
		spec
			.given([...preconditionEvents])
			.when({ kind: 'MyCommand', ...fields })
			.then([...expectedOutputEvents]);
	});

	it('error case', () => {
		spec
			.given([...preconditionEvents])
			.when({ kind: 'MyCommand', ...fields })
			.thenThrows((e: Error) => e instanceof MyError);
	});

	it('idempotent case', () => {
		spec
			.given([...eventsIncludingAlreadyDone])
			.when({ kind: 'MyCommand', ...fields })
			.then([]); // No new events
	});
});
```

### View Test Pattern

```typescript
import { describe, it } from 'vitest';
import { ViewSpecification } from '../test-specs.ts';

describe('myView', () => {
	const spec = ViewSpecification.for(myView);

	it('projects state from events', () => {
		spec.given([...events]).then({ ...expectedState });
	});

	it('returns null with no events', () => {
		spec.given([]).then(null);
	});
});
```

## 5. Infrastructure

### Repository Pattern

One per decider. Maps command fields to `(tag, eventType)` query tuples:

```typescript
import type postgres from 'postgres';
import { PostgresEventRepository } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '../pg-client-adapter.ts';

export const myRepository = (sql: postgres.Sql) =>
	new PostgresEventRepository<MyCommand, MyInputEvent, MyOutputEvent>(
		createSqlClient(sql),
		(cmd) => [
			['entityId:' + cmd.entityId, 'EventTypeA'],
			['entityId:' + cmd.entityId, 'EventTypeB'],
		],
	);
```

**Deriving query tuples:**
For each event type in the decider's Ei:

1. Find the event's `tagFields`
2. Find the matching field on the command
3. Create: `['tagField:' + cmd.field, 'EventKind']`

### Command Handler Pattern

```typescript
import type postgres from 'postgres';
import { EventSourcedCommandHandler } from '@fraktalio/fmodel-decider';

export const myHandler = (sql: postgres.Sql) =>
	new EventSourcedCommandHandler(myDecider, myRepository(sql));
```

### Query Handler Pattern

```typescript
import type postgres from 'postgres';
import { EventSourcedQueryHandler, PostgresEventLoader } from '@fraktalio/fmodel-decider';
import { createSqlClient } from '@/infrastructure/pg-client-adapter.ts';

export const myQueryHandler = (sql: postgres.Sql) =>
	new EventSourcedQueryHandler(myView, new PostgresEventLoader<MyViewEvent>(createSqlClient(sql)));
```

## 6. Barrel Exports

### `src/domain/index.ts`

```typescript
export * from './api.ts';
export { createRestaurantDecider } from './deciders/createRestaurant.ts';
export { restaurantView } from './views/restaurantView.ts';
export type { RestaurantViewState, RestaurantEvent } from './views/restaurantView.ts';
```

### `src/infrastructure/index.ts`

```typescript
export { createSqlClient } from './pg-client-adapter.ts';
export { createRestaurantRepository } from './repositories/createRestaurant.ts';
```

### `src/application/index.ts`

```typescript
export { createRestaurantHandler } from './command-handlers/createRestaurant.ts';
export { restaurantQueryHandler } from './query-handlers/restaurantQuery.ts';
export { handleCommand, json } from './api.ts';
```
