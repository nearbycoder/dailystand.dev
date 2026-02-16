ALTER TABLE "standup_share" ADD COLUMN "expires_at" timestamp;
--> statement-breakpoint
CREATE INDEX "standup_share_expires_idx" ON "standup_share" USING btree ("expires_at");
