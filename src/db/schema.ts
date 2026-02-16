import { relations } from "drizzle-orm"
import {
	date,
	index,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core"

export * from "./auth-schema"
import { user, organization, team } from "./auth-schema"

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
)

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
}))

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
	],
)

export const standupShareRelations = relations(standupShare, ({ one }) => ({
	user: one(user, {
		fields: [standupShare.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [standupShare.organizationId],
		references: [organization.id],
	}),
}))
