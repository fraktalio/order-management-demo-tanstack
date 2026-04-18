import postgres from 'postgres';

export async function withDb<T>(env: Env, fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
	const sql = postgres(env.HYPERDRIVE.connectionString, {
		connect_timeout: 10,
		idle_timeout: 0,
		max: 1,
	});
	try {
		return await fn(sql);
	} catch (err) {
		console.error('[DB]', err);
		throw new Error('Database error occurred');
	} finally {
		await sql.end({ timeout: 5 }).catch((err) => {
			console.error('[DB] Failed to close connection:', err);
		});
	}
}
