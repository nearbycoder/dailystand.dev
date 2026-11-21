import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema.ts";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error(
		"DATABASE_URL is required. For local scripts, ensure .env.local is loaded.",
	);
}

const poolMax = (() => {
	const parsed = Number(process.env.DATABASE_POOL_MAX ?? "20");
	if (!Number.isFinite(parsed) || parsed < 1) return 20;
	return Math.floor(parsed);
})();

const pool = new pg.Pool({
	connectionString,
	max: poolMax,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 10_000,
	allowExitOnIdle: true,
});

export const db = drizzle(pool, { schema });
