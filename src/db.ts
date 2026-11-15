import pg from "pg";
import { config } from "./config.js";

let pool: pg.Pool | undefined;

export function db(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: config().DATABASE_URL, max: 5 });
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export type Queryable = pg.Pool | pg.PoolClient;

export async function withTx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
