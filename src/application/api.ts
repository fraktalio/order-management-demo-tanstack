/**
 * Shared helpers for API route handlers.
 */

import { DomainError } from '@/domain/api.ts';

/** Standard JSON response */
export const json = (data: unknown, status = 200) => Response.json(data, { status });

/** Runs a domain operation and maps errors to appropriate HTTP responses */
export async function handleCommand<T>(fn: () => Promise<T>): Promise<Response> {
	try {
		const result = await fn();
		return json(result, 201);
	} catch (error) {
		if (error instanceof DomainError) {
			return json({ error: error.message }, 409);
		}
		console.error('[API]', error);
		return json({ error: 'Internal server error' }, 500);
	}
}
