/**
 * Vitest adapter for fmodel-decider's Given–When–Then test DSL.
 *
 * Uses the library's createSpecs() factory wired to Vitest's expect.
 *
 * Note: The JSR npm compatibility layer has a TS resolution quirk where
 * createSpecs isn't visible to the language server despite being exported.
 * It works correctly at runtime and in tests.
 */

import { expect } from 'vitest';
// @ts-expect-error JSR npm compat layer TS resolution quirk — works at runtime
import { createSpecs } from '@fraktalio/fmodel-decider';

export const { DeciderEventSourcedSpec, ViewSpecification } = createSpecs({
	assertEquals: <T>(actual: T, expected: T) => expect(actual).toEqual(expected),
	assert: (condition: boolean) => expect(condition).toBeTruthy(),
});
