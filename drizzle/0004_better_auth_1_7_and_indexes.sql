ALTER TABLE "apikey" ADD COLUMN IF NOT EXISTS "config_id" text DEFAULT 'default' NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'apikey'
			AND column_name = 'user_id'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'apikey'
			AND column_name = 'reference_id'
	) THEN
		ALTER TABLE "apikey" DROP CONSTRAINT IF EXISTS "apikey_user_id_user_id_fk";
		ALTER TABLE "apikey" RENAME COLUMN "user_id" TO "reference_id";
	END IF;
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "apikey_userId_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apikey_configId_idx" ON "apikey" USING btree ("config_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apikey_referenceId_idx" ON "apikey" USING btree ("reference_id");
--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN IF NOT EXISTS "member_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "team" AS t
SET "member_count" = (
	SELECT count(*)::integer
	FROM "team_member" AS tm
	WHERE tm."team_id" = t."id"
);
--> statement-breakpoint
ALTER TABLE "team_member" ADD COLUMN IF NOT EXISTS "membership_key" text;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'team_member_membership_key_unique'
	) THEN
		ALTER TABLE "team_member" ADD CONSTRAINT "team_member_membership_key_unique" UNIQUE("membership_key");
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "billing_interval" text;
--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "stripe_schedule_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_referenceId_idx" ON "subscription" USING btree ("reference_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_org_user_idx" ON "member" USING btree ("organization_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "standup_entry_org_date_idx" ON "standup_entry" USING btree ("organization_id", "date");
