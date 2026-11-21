import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

export const MIGRATION_ADVISORY_LOCK_KEY = 842917362;

export const LEGACY_BASELINE_TAGS = new Set([
	"0000_groovy_winter_soldier",
	"0001_api_key_support",
	"0002_share_link_expiry",
	"0003_long_jimmy_woo",
]);

type JournalEntry = {
	idx: number;
	when: number;
	tag: string;
	breakpoints: boolean;
};

type JournalFile = {
	entries: JournalEntry[];
};

export interface LegacySchemaProbe {
	hasStandupEntryTable: boolean;
	hasApiKeyTable: boolean;
	hasStandupShareExpiresAtColumn: boolean;
	hasUserBioColumn: boolean;
}

export interface BaselineMigrationRecord {
	tag: string;
	hash: string;
	createdAt: number;
}

export function shouldBaselineLegacyPushDb(probe: LegacySchemaProbe): boolean {
	return (
		probe.hasStandupEntryTable &&
		probe.hasApiKeyTable &&
		probe.hasStandupShareExpiresAtColumn &&
		probe.hasUserBioColumn
	);
}

export function readLegacyBaselineEntries(
	migrationsFolder: string,
): BaselineMigrationRecord[] {
	const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
	const journal = JSON.parse(
		fs.readFileSync(journalPath, "utf8"),
	) as JournalFile;

	const records: BaselineMigrationRecord[] = [];
	for (const entry of journal.entries) {
		if (!LEGACY_BASELINE_TAGS.has(entry.tag)) continue;
		const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
		const sqlContent = fs.readFileSync(sqlPath, "utf8");
		const hash = crypto.createHash("sha256").update(sqlContent).digest("hex");
		records.push({
			tag: entry.tag,
			hash,
			createdAt: entry.when,
		});
	}
	return records;
}

async function probeLegacySchema(
	client: pg.Client,
): Promise<LegacySchemaProbe> {
	const result = await client.query<{
		has_standup_entry: boolean;
		has_apikey: boolean;
		has_standup_share_expires_at: boolean;
		has_user_bio: boolean;
	}>(`
		SELECT
			EXISTS (
				SELECT 1 FROM information_schema.tables
				WHERE table_schema = 'public' AND table_name = 'standup_entry'
			) AS has_standup_entry,
			EXISTS (
				SELECT 1 FROM information_schema.tables
				WHERE table_schema = 'public' AND table_name = 'apikey'
			) AS has_apikey,
			EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = 'standup_share' AND column_name = 'expires_at'
			) AS has_standup_share_expires_at,
			EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'bio'
			) AS has_user_bio
	`);

	const row = result.rows[0];
	return {
		hasStandupEntryTable: Boolean(row?.has_standup_entry),
		hasApiKeyTable: Boolean(row?.has_apikey),
		hasStandupShareExpiresAtColumn: Boolean(row?.has_standup_share_expires_at),
		hasUserBioColumn: Boolean(row?.has_user_bio),
	};
}

export async function runStartupMigrations(options?: {
	connectionString?: string;
	migrationsFolder?: string;
}): Promise<{ baselinedCount: number }> {
	const connectionString =
		options?.connectionString ?? process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error("DATABASE_URL is required to run database migrations.");
	}

	const migrationsFolder =
		options?.migrationsFolder ?? path.resolve(process.cwd(), "drizzle");

	const client = new pg.Client({ connectionString });
	await client.connect();

	let lockAcquired = false;
	let baselinedCount = 0;

	try {
		await client.query("SELECT pg_advisory_lock($1)", [
			MIGRATION_ADVISORY_LOCK_KEY,
		]);
		lockAcquired = true;

		await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
		await client.query(`
			CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`);

		const countResult = await client.query<{ count: number }>(
			'SELECT count(*)::int AS count FROM "drizzle"."__drizzle_migrations"',
		);
		const existingMigrationsCount = countResult.rows[0]?.count ?? 0;

		if (existingMigrationsCount === 0) {
			const probe = await probeLegacySchema(client);
			if (shouldBaselineLegacyPushDb(probe)) {
				const baselineEntries = readLegacyBaselineEntries(migrationsFolder);
				await client.query("BEGIN");
				try {
					for (const record of baselineEntries) {
						await client.query(
							'INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)',
							[record.hash, record.createdAt],
						);
					}
					await client.query("COMMIT");
					baselinedCount = baselineEntries.length;
				} catch (error) {
					await client.query("ROLLBACK");
					throw error;
				}
			}
		}

		await migrate(drizzle(client), { migrationsFolder });
		return { baselinedCount };
	} finally {
		if (lockAcquired) {
			await client
				.query("SELECT pg_advisory_unlock($1)", [MIGRATION_ADVISORY_LOCK_KEY])
				.catch(() => undefined);
		}
		await client.end().catch(() => undefined);
	}
}

const isDirectExecution = (() => {
	const entry = process.argv[1];
	if (!entry) return false;
	return path.basename(entry) === "migrate.ts";
})();

if (isDirectExecution) {
	const startedAt = Date.now();
	(async () => {
		if (!process.env.DATABASE_URL) {
			try {
				const { config: dotenvConfig } = await import("dotenv");
				dotenvConfig({ path: [".env.local", ".env"] });
			} catch {
				// Production containers inject DATABASE_URL directly without devDependencies.
			}
		}
		const { baselinedCount } = await runStartupMigrations();
		const elapsedMs = Date.now() - startedAt;
		const baselineNote =
			baselinedCount > 0
				? ` (baselined ${baselinedCount} legacy migrations)`
				: "";
		console.info(`[DB] Migrations up to date${baselineNote} in ${elapsedMs}ms`);
		process.exit(0);
	})().catch((error) => {
		console.error("[DB] Startup migration failed:", error);
		process.exit(1);
	});
}
