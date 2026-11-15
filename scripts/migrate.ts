// Local/dev helper. In Neon, paste migrations/*.sql into the SQL editor instead.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const dir = join(import.meta.dirname, "..", "migrations");
const client = new pg.Client({ connectionString: url });
await client.connect();
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await client.query(readFileSync(join(dir, f), "utf8"));
  console.log(`applied ${f}`);
}
await client.end();
