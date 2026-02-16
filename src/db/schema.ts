import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export * from "./auth-schema";

import { organization, team, user } from "./auth-schema";

export const standupEntry = pgTable(
	"standup_entry",
	{
		id: serial("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		teamId: text("team_id").references(() => team.id, {
			onDelete: "set null",
		}),
		date: date("date").notNull(),
		type: text("type", { enum: ["completed", "planned", "blocker"] }).notNull(),
		content: text("content").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("standup_entry_userId_idx").on(table.userId),
		index("standup_entry_orgId_idx").on(table.organizationId),
		index("standup_entry_date_idx").on(table.date),
		index("standup_entry_user_org_date_idx").on(
			table.userId,
			table.organizationId,
			table.date,
		),
	],
);

export const standupEntryRelations = relations(standupEntry, ({ one }) => ({
	user: one(user, {
		fields: [standupEntry.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [standupEntry.organizationId],
		references: [organization.id],
	}),
	team: one(team, {
		fields: [standupEntry.teamId],
		references: [team.id],
	}),
}));

export const standupShare = pgTable(
	"standup_share",
	{
		id: serial("id").primaryKey(),
		token: text("token").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		date: date("date").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		expiresAt: timestamp("expires_at"),
		revokedAt: timestamp("revoked_at"),
	},
	(table) => [
		uniqueIndex("standup_share_token_uidx").on(table.token),
		uniqueIndex("standup_share_user_org_date_uidx").on(
			table.userId,
			table.organizationId,
			table.date,
		),
		index("standup_share_user_org_idx").on(table.userId, table.organizationId),
		index("standup_share_expires_idx").on(table.expiresAt),
	],
);

export const standupShareRelations = relations(standupShare, ({ one }) => ({
	user: one(user, {
		fields: [standupShare.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [standupShare.organizationId],
		references: [organization.id],
	}),
}));

export const emailDigestPreference = pgTable(
	"email_digest_preference",
	{
		id: serial("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		enabled: boolean("enabled").default(false).notNull(),
		cadence: text("cadence", { enum: ["weekly", "daily"] })
			.default("weekly")
			.notNull(),
		timezone: text("timezone").default("UTC").notNull(),
		lastDailySentAt: timestamp("last_daily_sent_at"),
		lastWeeklySentAt: timestamp("last_weekly_sent_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("email_digest_pref_user_org_uidx").on(
			table.userId,
			table.organizationId,
		),
		index("email_digest_pref_org_idx").on(table.organizationId),
		index("email_digest_pref_enabled_idx").on(table.enabled),
	],
);

export const emailDigestPreferenceRelations = relations(
	emailDigestPreference,
	({ one }) => ({
		user: one(user, {
			fields: [emailDigestPreference.userId],
			references: [user.id],
		}),
		organization: one(organization, {
			fields: [emailDigestPreference.organizationId],
			references: [organization.id],
		}),
	}),
);
