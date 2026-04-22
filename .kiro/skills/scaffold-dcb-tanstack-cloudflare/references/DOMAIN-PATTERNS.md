# Domain Patterns Reference

All domain code lives in `src/domain/` with zero infrastructure dependencies.

## 1. Shared Types (`src/domain/api.ts`)

### Branded Type IDs

```typescript
import type { TypeSafeEventShape } from '@fraktalio/fmodel-decider';

type Brand<T, B> = T & { readonly __brand: B };

export type RestaurantId = Brand<string, 'RestaurantId'>;
export type OrderId = Brand<string, 'OrderId'>;

export const restaurantId = (id: string): RestaurantId => id as RestaurantId;
export const orderId = (id: string): OrderId => id as OrderId;
```

Rules:

- One branded type per unique entity ID
- Factory function is lowercase camelCase matching the type name
- Always `Brand<string, 'TypeName'>`

### Domain Errors

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

Rules:

- All errors extend `DomainError`
- Constructor takes the relevant ID(s)
- Error name is set automatically via `this.name = this.constructor.name`

### Value Objects

```typescript
export type RestaurantName = string;
export type OrderStatus = 'NOT_CREATED' | 'CREATED' | 'PAID' | 'PREPARED';

export type MenuItem = {
	readonly menuItemId: MenuItemId;
	readonly name: MenuItemName;
	readonly price: MenuItemPrice;
};
```

Rules:

- Simple type aliases for primitives
- Object types use `readonly` fields
- Status types are string literal unions

### Command Types

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

- Discriminated union using `kind` field
- `kind` value matches the type name exactly
- All fields are `readonly`
- Union type `Command` includes all commands

### Event Types

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

- Use `TypeSafeEventShape<Shape, TagFields>` from `@fraktalio/fmodel-decider`
- Second type parameter lists the ID field names used for tagging
- Every event has `kind`, `final: boolean`, and `tagFields`
- `tagFields` at the type level matches the second generic parameter
- Entity-scoped events: `['entityId']`
- Cross-entity events: `['entityId1', 'entityId2']`

## 2. Deciders (`src/domain/deciders/`)

### Simple Decider (existence check)

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
	CreateRestaurantCommand, // C  — command
	CreateRestaurantState, // S  — state
	RestaurantCreatedEvent, // Ei — input events (reads)
	RestaurantCreatedEvent // Eo — output events (produces)
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

### Cross-Entity Decider (reads from multiple entities)

```typescript
import { DcbDecider } from '@fraktalio/fmodel-decider';
import {
	MenuItemsNotAvailableError,
	type PaymentExemptedEvent,
	type PaymentInitiatedEvent,
	type PlaceOrderCommand,
	type RestaurantCreatedEvent,
	type RestaurantMenu,
	type RestaurantId,
	type RestaurantMenuChangedEvent,
	RestaurantNotFoundError,
	type RestaurantOrderPlacedEvent,
} from '../api.ts';

type PlaceOrderState = {
	readonly restaurantId: RestaurantId | null;
	readonly menu: RestaurantMenu | null;
	readonly orderPlaced: boolean;
};

export const placeOrderDecider: DcbDecider<
	PlaceOrderCommand,
	PlaceOrderState,
	RestaurantCreatedEvent | RestaurantMenuChangedEvent | RestaurantOrderPlacedEvent,
	RestaurantOrderPlacedEvent | PaymentInitiatedEvent | PaymentExemptedEvent
> = new DcbDecider(
	(
		command,
		currentState,
	): readonly (RestaurantOrderPlacedEvent | PaymentInitiatedEvent | PaymentExemptedEvent)[] => {
		switch (command?.kind) {
			case 'PlaceOrderCommand': {
				if (currentState.restaurantId === null) {
					throw new RestaurantNotFoundError(command.restaurantId);
				}
				if (currentState.orderPlaced) {
					return []; // Idempotent: duplicate command is a no-op
				}
				// ... validation logic ...
				return [orderPlacedEvent, paymentEvent];
			}
			default:
				return [];
		}
	},
	(currentState, event) => {
		switch (event?.kind) {
			case 'RestaurantCreatedEvent':
				return { restaurantId: event.restaurantId, menu: event.menu, orderPlaced: false };
			case 'RestaurantMenuChangedEvent':
				return { ...currentState, menu: event.menu };
			case 'RestaurantOrderPlacedEvent':
				return { ...currentState, orderPlaced: true };
			default:
				return currentState;
		}
	},
	{ restaurantId: null, menu: null, orderPlaced: false } as PlaceOrderState,
);
```

### Status-Based Decider (state machine)

```typescript
type MarkOrderPaidStatus = 'NOT_FOUND' | 'PLACED' | 'PAYMENT_INITIATED' | 'PAID';

type MarkOrderPaidState = {
	readonly status: MarkOrderPaidStatus;
};

export const markOrderPaidDecider: DcbDecider<
	MarkOrderPaidCommand,
	MarkOrderPaidState,
	RestaurantOrderPlacedEvent | PaymentInitiatedEvent | OrderPaidEvent,
	OrderPaidEvent
> = new DcbDecider(
	(command, currentState) => {
		switch (command?.kind) {
			case 'MarkOrderPaidCommand': {
				switch (currentState.status) {
					case 'NOT_FOUND':
						throw new OrderNotFoundError(command.orderId);
					case 'PLACED':
						throw new PaymentNotInitiatedError(command.orderId);
					case 'PAYMENT_INITIATED':
						return [
							{
								kind: 'OrderPaidEvent',
								orderId: command.orderId,
								final: false,
								tagFields: ['orderId'],
							},
						];
					case 'PAID':
						return []; // Idempotent
					default: {
						const _exhaustiveCheck: never = currentState.status;
						throw new Error(`Unexpected status: ${_exhaustiveCheck}`);
					}
				}
			}
			default:
				return [];
		}
	},
	(currentState, event) => {
		switch (event?.kind) {
			case 'RestaurantOrderPlacedEvent':
				return { status: 'PLACED' };
			case 'PaymentInitiatedEvent':
				return { status: 'PAYMENT_INITIATED' };
			case 'OrderPaidEvent':
				return { status: 'PAID' };
			default:
				return currentState;
		}
	},
	{ status: 'NOT_FOUND' } as MarkOrderPaidState,
);
```

### Decider Design Rules

1. **State derivation**: derive state shape from error scenarios:
   - `AlreadyExists` → track existence (`Id | null` or `boolean`)
   - `NotFound` → track existence
   - `InvalidStatus` → track status (string literal union)
   - `ValidationError` → track the data being validated

2. **Ei (input events)**: all events the decider needs to reconstruct state.
   Found by looking at what `evolve` handles.

3. **Eo (output events)**: all events the decider can produce.
   Found by looking at what `decide` returns.

4. **Idempotency**: duplicate commands return `[]`, never throw.

5. **tagFields**: match the ID fields used in repository query tuples.

6. **`final: false`**: always set to `false` (reserved for future use).

7. **Exhaustive switch**: use `never` check in default for status-based deciders.

## 3. Views (`src/domain/views/`)

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
          return currentState !== null
            ? { ...currentState, menu: event.menu }
            : currentState;
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

### View Design Rules

1. **Initial state**: always `null`
2. **First event**: creates the state object
3. **Subsequent events**: update existing state (guard with `currentState !== null`)
4. **Exhaustive switch**: use `// @ts-expect-error exhaustive check` + `never`
5. **Event union**: defined locally in the view file, also exported
6. **State type**: exported for use in UI components

## 4. Test Specs

### Test Setup (`src/domain/test-specs.ts`)

```typescript
import { expect } from 'vitest';
import { createSpecs } from '@fraktalio/fmodel-decider';

export const { DeciderEventSourcedSpec, ViewSpecification } = createSpecs({
	assertEquals: <T>(actual: T, expected: T) => expect(actual).toEqual(expected),
	assert: (condition: boolean) => expect(condition).toBeTruthy(),
});
```

### Decider Tests

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

### View Tests

```typescript
import { describe, it } from 'vitest';
import { ViewSpecification } from '../test-specs.ts';
import { restaurantView } from '../views/restaurantView.ts';
import { rId, menu, newMenu, restaurantCreated, menuChanged } from '../fixtures.ts';

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

### Fixtures (`src/domain/fixtures.ts`)

```typescript
import { restaurantId, orderId, menuItemId, restaurantMenuId, ... } from './api.ts';

export const rId = restaurantId('r1');
export const oId = orderId('o1');

export const menu = {
  menuId: restaurantMenuId('rm1'),
  cuisine: 'SERBIAN' as const,
  menuItems: [{ menuItemId: menuItemId('m1'), name: 'Ćevapi', price: '12.00' }],
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

- Short, reusable IDs (`r1`, `o1`, `m1`)
- One fixture per event type
- Fixtures match what deciders produce
- Reuse across all test files
