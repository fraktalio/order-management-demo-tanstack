/**
 * Adapts postgres.js (`postgres` npm package) to fmodel-decider's SqlClient interface.
 *
 * SqlClient requires a single method: queryObject<T>(sql) → { rows: T[] }
 * See: https://github.com/fraktalio/fmodel-decider#concrete-repository-example-postgresql
 */

import type postgres from 'postgres';
import type { SqlClient } from '@fraktalio/fmodel-decider';

export const createSqlClient = (sql: postgres.Sql): SqlClient => ({
	queryObject: async <T>(query: string) => ({ rows: (await sql.unsafe(query)) as T[] }),
});
