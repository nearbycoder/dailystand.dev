import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
	member,
	standupEntry,
	standupShare,
	team,
	teamMember,
} from "@/db/schema";
import {
	getHistoryFloorDate,
	maxHistoryDays,
	resolveOrganizationPlanLimits,
} from "@/lib/plan-limits";
import { orgProcedure, publicProcedure } from "../init";

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const analyticsRangeDaysSchema = z.union([
	z.literal(7),
	z.literal(14),
	z.literal(30),
	z.literal(60),
	z.literal(90),
]);

const standupEntriesInputSchema = z.array(
	z.object({
		type: z.enum(["completed", "planned", "blocker"]),
		content: z.string().min(1),
	}),
);
const SHARE_LINK_TTL_DAYS = 30;

function groupEntriesByType<
	T extends { type: "completed" | "planned" | "blocker"; content: string },
>(entries: T[]) {
	const grouped = {
		completed: [] as string[],
		planned: [] as string[],
		blockers: [] as string[],
	};

	for (const entry of entries) {
		if (entry.type === "completed") grouped.completed.push(entry.content);
		else if (entry.type === "planned") grouped.planned.push(entry.content);
		else if (entry.type === "blocker") grouped.blockers.push(entry.content);
	}

	return grouped;
}

function isoDate(date: Date): string {
	return date.toISOString().split("T")[0];
}

function enumerateDateRange(startDate: Date, endDate: Date): string[] {
	const cursor = new Date(startDate);
	const values: string[] = [];
	while (cursor <= endDate) {
		values.push(isoDate(cursor));
		cursor.setDate(cursor.getDate() + 1);
	}
	return values;
}

const KEYWORD_STOP_WORDS = new Set([
	"about",
	"after",
	"again",
	"against",
	"between",
	"build",
	"blocked",
	"could",
	"daily",
	"deploy",
	"done",
	"entry",
	"from",
	"have",
	"into",
	"need",
	"next",
	"only",
	"plan",
	"planned",
	"review",
	"same",
	"ship",
	"standup",
	"start",
	"still",
	"team",
	"that",
	"their",
	"there",
	"this",
	"today",
	"update",
	"with",
	"work",
]);

function extractKeywordTokens(content: string): string[] {
	const cleaned = content
		.toLowerCase()
		.replace(/https?:\/\/\S+/g, " ")
		.replace(/www\.\S+/g, " ");

	const tokens: string[] = [];
	for (const token of cleaned.split(/[^a-z0-9]+/g)) {
		if (token.length < 4) continue;
		if (KEYWORD_STOP_WORDS.has(token)) continue;
		tokens.push(token);
	}
	return tokens;
}

function extractTopKeywords(contents: string[], limit = 12) {
	const counts = new Map<string, number>();
	for (const content of contents) {
		for (const token of extractKeywordTokens(content)) {
			counts.set(token, (counts.get(token) ?? 0) + 1);
		}
	}

	return Array.from(counts.entries())
		.map(([term, count]) => ({ term, count }))
		.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
		.slice(0, limit);
}

function teamScopeCondition(teamId: string | null) {
	return teamId === null
		? isNull(standupEntry.teamId)
		: eq(standupEntry.teamId, teamId);
}

function teamOrGeneralScopeCondition(teamId: string) {
	return or(eq(standupEntry.teamId, teamId), isNull(standupEntry.teamId)) ??
		teamScopeCondition(teamId);
}

function chooseEntriesForTeam<T extends { teamId: string | null }>(
	entries: T[],
	teamId?: string,
) {
	if (!teamId) return entries;
	const teamSpecific = entries.filter((entry) => entry.teamId === teamId);
	if (teamSpecific.length > 0) return teamSpecific;
	return entries.filter((entry) => entry.teamId === null);
}

function escapeCsvCell(value: string): string {
	const normalized = value.replace(/\r?\n|\r/g, " ").trim();
	if (/[",\n]/.test(normalized)) {
		return `"${normalized.replace(/"/g, '""')}"`;
	}
	return normalized;
}

function pushMarkdownSection(
	lines: string[],
	heading: string,
	items: string[],
) {
	if (items.length === 0) return;
	lines.push(`#### ${heading}`);
	for (const item of items) lines.push(`- ${item}`);
	lines.push("");
}

async function getUserTeamIdsInOrganization(
	userId: string,
	organizationId: string,
) {
	const memberships = await db.query.teamMember.findMany({
		where: eq(teamMember.userId, userId),
		columns: { teamId: true },
		with: {
			team: {
				columns: { organizationId: true },
			},
		},
	});

	return new Set(
		memberships
			.filter((membership) => membership.team.organizationId === organizationId)
			.map((membership) => membership.teamId),
	);
}

async function resolveHistoryWindow(organizationId: string, userId: string) {
	const resolved = await resolveOrganizationPlanLimits({
		organizationId,
		userId,
	});
	return {
		maxDays:
			resolved.limits.historyDays < 0
				? Number.MAX_SAFE_INTEGER
				: resolved.limits.historyDays,
		floorDate: getHistoryFloorDate(resolved.limits.historyDays),
	};
}

function assertTeamScopeAccess(
	teamId: string | null,
	allowedTeamIds: Set<string>,
) {
	if (teamId && !allowedTeamIds.has(teamId)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You can only submit standups for your teams.",
		});
	}
}

function canManageOrganizationRole(role: string) {
	return role
		.split(",")
		.map((part) => part.trim().toLowerCase())
		.some((part) => part === "owner" || part === "admin");
}

async function assertActorCanReadTeamScope(
	userId: string,
	organizationId: string,
	teamId?: string,
) {
	if (!teamId) return;
	const [targetTeam, organizationMembership, scopedTeamMembership] =
		await Promise.all([
			db.query.team.findFirst({
				where: and(eq(team.id, teamId), eq(team.organizationId, organizationId)),
				columns: { id: true },
			}),
			db.query.member.findFirst({
				where: and(
					eq(member.organizationId, organizationId),
					eq(member.userId, userId),
				),
				columns: { role: true },
			}),
			db.query.teamMember.findFirst({
				where: and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)),
				columns: { teamId: true },
			}),
		]);

	if (!targetTeam) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Invalid team scope for this organization.",
		});
	}

	if (!organizationMembership) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You are not a member of this organization.",
		});
	}

	if (
		scopedTeamMembership ||
		canManageOrganizationRole(organizationMembership.role)
	) {
		return;
	}
	throw new TRPCError({
		code: "FORBIDDEN",
		message: "You can only read standups for your teams.",
	});
}

function buildShareExpiryDate(now = new Date()): Date {
	const expiresAt = new Date(now);
	expiresAt.setDate(expiresAt.getDate() + SHARE_LINK_TTL_DAYS);
	return expiresAt;
}

export const standupsRouter = {
	upsert: orgProcedure
		.input(
			z.object({
				date: dateStringSchema,
				teamId: z.string().nullable().optional(),
				entries: standupEntriesInputSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const orgId = ctx.organizationId;
			const targetTeamId = input.teamId ?? null;
			const allowedTeamIds = await getUserTeamIdsInOrganization(userId, orgId);
			assertTeamScopeAccess(targetTeamId, allowedTeamIds);

			await db
				.delete(standupEntry)
				.where(
					and(
						eq(standupEntry.userId, userId),
						eq(standupEntry.organizationId, orgId),
						eq(standupEntry.date, input.date),
						teamScopeCondition(targetTeamId),
					),
				);

			if (input.entries.length === 0) return { success: true };

			await db.insert(standupEntry).values(
				input.entries.map((entry) => ({
					userId,
					organizationId: orgId,
					teamId: targetTeamId,
					date: input.date,
					type: entry.type,
					content: entry.content,
				})),
			);

			return { success: true };
		}),

	upsertBatch: orgProcedure
		.input(
			z.object({
				date: dateStringSchema,
				replaceScopes: z.array(z.string().nullable()).default([null]),
				submissions: z
					.array(
						z.object({
							teamId: z.string().nullable(),
							entries: standupEntriesInputSchema,
						}),
					)
					.default([]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const orgId = ctx.organizationId;
			const allowedTeamIds = await getUserTeamIdsInOrganization(userId, orgId);

			const scopeIds = new Set(
				input.replaceScopes.map((scope) =>
					scope === null ? "__GLOBAL__" : scope,
				),
			);
			for (const submission of input.submissions) {
				scopeIds.add(submission.teamId ?? "__GLOBAL__");
			}

			const scopes = Array.from(scopeIds).map((scope) =>
				scope === "__GLOBAL__" ? null : scope,
			);
			for (const scope of scopes) {
				assertTeamScopeAccess(scope, allowedTeamIds);
			}

			for (const scope of scopes) {
				await db
					.delete(standupEntry)
					.where(
						and(
							eq(standupEntry.userId, userId),
							eq(standupEntry.organizationId, orgId),
							eq(standupEntry.date, input.date),
							teamScopeCondition(scope),
						),
					);
			}

			const rowsToInsert = input.submissions.flatMap((submission) =>
				submission.entries.map((entry) => ({
					userId,
					organizationId: orgId,
					teamId: submission.teamId,
					date: input.date,
					type: entry.type,
					content: entry.content,
				})),
			);

			if (rowsToInsert.length > 0) {
				await db.insert(standupEntry).values(rowsToInsert);
			}

			return { success: true };
		}),

	getByDate: orgProcedure
		.input(
			z.object({
				date: dateStringSchema,
				teamId: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			await assertActorCanReadTeamScope(
				ctx.session.user.id,
				ctx.organizationId,
				input.teamId,
			);

			const { floorDate } = await resolveHistoryWindow(
				ctx.organizationId,
				ctx.session.user.id,
			);
			if (floorDate && input.date < floorDate) {
				return [];
			}

			const conditions = [
				eq(standupEntry.organizationId, ctx.organizationId),
				eq(standupEntry.date, input.date),
			];
			if (input.teamId) {
				conditions.push(teamOrGeneralScopeCondition(input.teamId));
			}

			const entries = await db.query.standupEntry.findMany({
				where: and(...conditions),
				with: {
					user: {
						columns: { id: true, name: true, image: true },
					},
				},
				orderBy: [desc(standupEntry.createdAt)],
			});

			// Group by user
			const byUser = new Map<string, typeof entries>();
			for (const entry of entries) {
				if (!byUser.has(entry.userId)) {
					byUser.set(entry.userId, []);
				}
				byUser.get(entry.userId)!.push(entry);
			}

			return Array.from(byUser.values()).map((userEntries) => {
				const selectedEntries = chooseEntriesForTeam(userEntries, input.teamId);
				return {
					user: selectedEntries[0]?.user ?? userEntries[0]!.user,
					...groupEntriesByType(selectedEntries),
				};
			});
		}),

	getByDateRange: orgProcedure
		.input(
			z.object({
				startDate: dateStringSchema,
				endDate: dateStringSchema,
				teamId: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			await assertActorCanReadTeamScope(
				ctx.session.user.id,
				ctx.organizationId,
				input.teamId,
			);

			const { floorDate } = await resolveHistoryWindow(
				ctx.organizationId,
				ctx.session.user.id,
			);

			const conditions = [
				eq(standupEntry.organizationId, ctx.organizationId),
				gte(standupEntry.date, input.startDate),
				lte(standupEntry.date, input.endDate),
			];
			if (floorDate) {
				conditions.push(gte(standupEntry.date, floorDate));
			}
			if (input.teamId) {
				conditions.push(teamOrGeneralScopeCondition(input.teamId));
			}

			const entries = await db.query.standupEntry.findMany({
				where: and(...conditions),
				with: {
					user: {
						columns: { id: true, name: true, image: true },
					},
				},
				orderBy: [desc(standupEntry.date), desc(standupEntry.createdAt)],
			});

			// Group by date, then by user entries.
			const byDate = new Map<string, Map<string, typeof entries>>();
			for (const entry of entries) {
				if (!byDate.has(entry.date)) {
					byDate.set(entry.date, new Map());
				}
				const dateMap = byDate.get(entry.date)!;
				if (!dateMap.has(entry.userId)) {
					dateMap.set(entry.userId, []);
				}
				dateMap.get(entry.userId)!.push(entry);
			}

			return Array.from(byDate.entries()).map(([date, usersMap]) => ({
				date,
				standups: Array.from(usersMap.values()).map((userEntries) => {
					const selectedEntries = chooseEntriesForTeam(
						userEntries,
						input.teamId,
					);
					return {
						user: selectedEntries[0]?.user ?? userEntries[0]!.user,
						...groupEntriesByType(selectedEntries),
					};
				}),
			}));
		}),

	exportRange: orgProcedure
		.input(
			z.object({
				startDate: dateStringSchema,
				endDate: dateStringSchema,
				teamId: z.string().optional(),
				format: z.enum(["markdown", "csv"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await assertActorCanReadTeamScope(
				ctx.session.user.id,
				ctx.organizationId,
				input.teamId,
			);

			const { floorDate } = await resolveHistoryWindow(
				ctx.organizationId,
				ctx.session.user.id,
			);

			if (input.startDate > input.endDate) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Start date must be before end date.",
				});
			}

			const rangeSpanMs =
				new Date(`${input.endDate}T00:00:00`).getTime() -
				new Date(`${input.startDate}T00:00:00`).getTime();
			const rangeDays = Math.floor(rangeSpanMs / 86_400_000) + 1;
			if (rangeDays > 366) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Maximum export window is 366 days.",
				});
			}

			const scopedTeam = input.teamId
				? await db.query.team.findFirst({
						where: and(
							eq(team.id, input.teamId),
							eq(team.organizationId, ctx.organizationId),
						),
						columns: {
							id: true,
							name: true,
						},
					})
				: null;

			if (input.teamId && !scopedTeam) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid team scope for this organization.",
				});
			}

			const conditions = [
				eq(standupEntry.organizationId, ctx.organizationId),
				gte(standupEntry.date, input.startDate),
				lte(standupEntry.date, input.endDate),
			];
			if (floorDate) {
				conditions.push(gte(standupEntry.date, floorDate));
			}
			if (input.teamId) {
				conditions.push(teamOrGeneralScopeCondition(input.teamId));
			}

			const entries = await db.query.standupEntry.findMany({
				where: and(...conditions),
				with: {
					user: {
						columns: { id: true, name: true, image: true },
					},
					team: {
						columns: { id: true, name: true },
					},
				},
				orderBy: [desc(standupEntry.date), desc(standupEntry.createdAt)],
			});

			const byDate = new Map<string, Map<string, typeof entries>>();
			for (const entry of entries) {
				if (!byDate.has(entry.date)) {
					byDate.set(entry.date, new Map());
				}
				const dateMap = byDate.get(entry.date)!;
				if (!dateMap.has(entry.userId)) {
					dateMap.set(entry.userId, []);
				}
				dateMap.get(entry.userId)!.push(entry);
			}

			const scopedDays = Array.from(byDate.entries())
				.sort((a, b) => a[0].localeCompare(b[0]))
				.map(([date, usersMap]) => {
					const standups = Array.from(usersMap.values())
						.map((userEntries) => {
							const selectedEntries = chooseEntriesForTeam(
								userEntries,
								input.teamId,
							);
							const grouped = groupEntriesByType(selectedEntries);
							return {
								user: selectedEntries[0]?.user ?? userEntries[0]!.user,
								teamId: selectedEntries[0]?.teamId ?? null,
								teamName: selectedEntries[0]?.team?.name ?? "GENERAL",
								...grouped,
							};
						})
						.sort((a, b) => a.user.name.localeCompare(b.user.name));
					return { date, standups };
				});

			const scopeLabel = scopedTeam?.name.toUpperCase() ?? "ALL_TEAMS";
			const metadataLines = [
				`- SCOPE: ${scopeLabel}`,
				`- DATE_RANGE: ${input.startDate} -> ${input.endDate}`,
				`- RECORDS: ${entries.length}`,
				"",
			];

			const markdownLines: string[] = [
				"# STANDUP_EXPORT",
				"",
				...metadataLines,
			];
			if (scopedDays.length === 0) {
				markdownLines.push("_No standup data in selected range._");
			} else {
				for (const day of scopedDays) {
					markdownLines.push(`## ${day.date}`, "");
					for (const standup of day.standups) {
						const teamTag = standup.teamName
							? ` (${standup.teamName.toUpperCase()})`
							: "";
						markdownLines.push(
							`### ${standup.user.name.toUpperCase()}${teamTag}`,
							"",
						);
						pushMarkdownSection(markdownLines, "Completed", standup.completed);
						pushMarkdownSection(markdownLines, "Planned", standup.planned);
						pushMarkdownSection(markdownLines, "Blockers", standup.blockers);
						if (
							standup.completed.length === 0 &&
							standup.planned.length === 0 &&
							standup.blockers.length === 0
						) {
							markdownLines.push("- No entries", "");
						}
					}
				}
			}

			const csvRows: string[] = [
				[
					"date",
					"user_id",
					"user_name",
					"team_id",
					"team_name",
					"type",
					"content",
				]
					.map(escapeCsvCell)
					.join(","),
			];
			for (const day of scopedDays) {
				for (const standup of day.standups) {
					const appendCsvRows = (
						type: "completed" | "planned" | "blocker",
						items: string[],
					) => {
						for (const item of items) {
							csvRows.push(
								[
									day.date,
									standup.user.id,
									standup.user.name,
									standup.teamId ?? "",
									standup.teamName,
									type,
									item,
								]
									.map((value) => escapeCsvCell(String(value)))
									.join(","),
							);
						}
					};
					appendCsvRows("completed", standup.completed);
					appendCsvRows("planned", standup.planned);
					appendCsvRows("blocker", standup.blockers);
				}
			}

			const teamFilePart = input.teamId
				? input.teamId.slice(0, 8)
				: "all-teams";
			const fileStem = `standups-${input.startDate}_to_${input.endDate}-${teamFilePart}`;
			const markdown = `${markdownLines.join("\n").trim()}\n`;
			const csv = `${csvRows.join("\n")}\n`;

			if (input.format === "markdown") {
				return {
					format: "markdown" as const,
					filename: `${fileStem}.md`,
					mimeType: "text/markdown;charset=utf-8",
					content: markdown,
				};
			}

			return {
				format: "csv" as const,
				filename: `${fileStem}.csv`,
				mimeType: "text/csv;charset=utf-8",
				content: csv,
			};
		}),

	getAnalytics: orgProcedure
		.input(
			z.object({
				rangeDays: analyticsRangeDaysSchema.default(30),
				teamId: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			await assertActorCanReadTeamScope(
				ctx.session.user.id,
				ctx.organizationId,
				input.teamId,
			);

			const { maxDays, floorDate } = await resolveHistoryWindow(
				ctx.organizationId,
				ctx.session.user.id,
			);
			const effectiveRangeDays = maxHistoryDays(maxDays, input.rangeDays);

			const endDateObj = new Date();
			endDateObj.setHours(0, 0, 0, 0);
			const startDateObj = new Date(endDateObj);
			startDateObj.setDate(startDateObj.getDate() - (effectiveRangeDays - 1));
			const startDate = isoDate(startDateObj);
			const endDate = isoDate(endDateObj);

			const teamRows = await db.query.team.findMany({
				where: eq(team.organizationId, ctx.organizationId),
				columns: { id: true, name: true },
				with: {
					teamMembers: {
						columns: { userId: true },
					},
				},
			});
			const teamById = new Map(teamRows.map((row) => [row.id, row]));

			if (input.teamId && !teamById.has(input.teamId)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid team filter.",
				});
			}

			const orgMembers = await db.query.member.findMany({
				where: eq(member.organizationId, ctx.organizationId),
				columns: { userId: true },
			});
			const selectedTeam = input.teamId ? teamById.get(input.teamId)! : null;
			const scopeMemberIds = new Set(
				selectedTeam
					? selectedTeam.teamMembers.map(
							(teamMemberRow) => teamMemberRow.userId,
						)
					: orgMembers.map((memberRow) => memberRow.userId),
			);
			const scopeMemberCount = scopeMemberIds.size;

			const conditions = [
				eq(standupEntry.organizationId, ctx.organizationId),
				gte(standupEntry.date, startDate),
				lte(standupEntry.date, endDate),
			];
			if (floorDate) {
				conditions.push(gte(standupEntry.date, floorDate));
			}
			if (input.teamId) {
				conditions.push(eq(standupEntry.teamId, input.teamId));
			}

			const entries = await db.query.standupEntry.findMany({
				where: and(...conditions),
				with: {
					user: {
						columns: { id: true, name: true },
					},
					team: {
						columns: { id: true, name: true },
					},
				},
				orderBy: [desc(standupEntry.date), desc(standupEntry.createdAt)],
			});

			const dateKeys = enumerateDateRange(startDateObj, endDateObj);
			const dailyMap = new Map(
				dateKeys.map((date) => [
					date,
					{
						completed: 0,
						planned: 0,
						blockers: 0,
						users: new Set<string>(),
					},
				]),
			);

			const memberCountByTeamId = new Map(
				teamRows.map((row) => [row.id, row.teamMembers.length]),
			);
			const teamStatsMap = new Map<
				string,
				{
					teamId: string | null;
					teamName: string;
					memberCount: number;
					entries: number;
					completed: number;
					planned: number;
					blockers: number;
					activeUsers: Set<string>;
					activeDays: Set<string>;
				}
			>();

			const userStatsMap = new Map<
				string,
				{
					userId: string;
					name: string;
					entries: number;
					completed: number;
					planned: number;
					blockers: number;
					days: Set<string>;
					teamIds: Set<string>;
				}
			>();

			const teamContributorStatsMap = new Map<
				string,
				Map<
					string,
					{
						userId: string;
						name: string;
						entries: number;
						completed: number;
						planned: number;
						blockers: number;
					}
				>
			>();
			const teamTaskSamplesMap = new Map<
				string,
				Array<{
					date: string;
					type: "completed" | "planned" | "blocker";
					content: string;
					userId: string;
					userName: string;
				}>
			>();
			const contributorTaskSamplesMap = new Map<
				string,
				Array<{
					date: string;
					type: "completed" | "planned" | "blocker";
					content: string;
					teamId: string | null;
					teamName: string;
				}>
			>();
			const dailyContributorStatsMap = new Map<
				string,
				Map<
					string,
					{
						userId: string;
						name: string;
						entries: number;
						completed: number;
						planned: number;
						blockers: number;
					}
				>
			>();
			const dailyTaskSamplesMap = new Map<
				string,
				Array<{
					type: "completed" | "planned" | "blocker";
					content: string;
					userId: string;
					userName: string;
					teamId: string | null;
					teamName: string;
				}>
			>();
			const keywordDetailsMap = new Map<
				string,
				{
					count: number;
					userIds: Set<string>;
					samples: Array<{
						date: string;
						type: "completed" | "planned" | "blocker";
						content: string;
						userId: string;
						userName: string;
					}>;
				}
			>();

			let totalCompleted = 0;
			let totalPlanned = 0;
			let totalBlockers = 0;
			const allUserIds = new Set<string>();

			for (const entry of entries) {
				const day = dailyMap.get(entry.date);
				if (day) {
					if (entry.type === "completed") day.completed++;
					else if (entry.type === "planned") day.planned++;
					else day.blockers++;
					day.users.add(entry.userId);
				}

				if (entry.type === "completed") totalCompleted++;
				else if (entry.type === "planned") totalPlanned++;
				else totalBlockers++;

				allUserIds.add(entry.userId);

				const teamKey = entry.teamId ?? "__GLOBAL__";
				if (!teamStatsMap.has(teamKey)) {
					teamStatsMap.set(teamKey, {
						teamId: entry.teamId,
						teamName: entry.team?.name ?? "GENERAL",
						memberCount: entry.teamId
							? (memberCountByTeamId.get(entry.teamId) ?? 0)
							: scopeMemberCount,
						entries: 0,
						completed: 0,
						planned: 0,
						blockers: 0,
						activeUsers: new Set(),
						activeDays: new Set(),
					});
				}

				const teamStat = teamStatsMap.get(teamKey)!;
				teamStat.entries++;
				teamStat.activeUsers.add(entry.userId);
				teamStat.activeDays.add(entry.date);
				if (entry.type === "completed") teamStat.completed++;
				else if (entry.type === "planned") teamStat.planned++;
				else teamStat.blockers++;

				if (!userStatsMap.has(entry.userId)) {
					userStatsMap.set(entry.userId, {
						userId: entry.user.id,
						name: entry.user.name,
						entries: 0,
						completed: 0,
						planned: 0,
						blockers: 0,
						days: new Set(),
						teamIds: new Set(),
					});
				}

				const userStat = userStatsMap.get(entry.userId)!;
				userStat.entries++;
				userStat.days.add(entry.date);
				if (entry.teamId) userStat.teamIds.add(entry.teamId);
				if (entry.type === "completed") userStat.completed++;
				else if (entry.type === "planned") userStat.planned++;
				else userStat.blockers++;

				if (!teamContributorStatsMap.has(teamKey)) {
					teamContributorStatsMap.set(teamKey, new Map());
				}
				const teamContributorMap = teamContributorStatsMap.get(teamKey)!;
				if (!teamContributorMap.has(entry.userId)) {
					teamContributorMap.set(entry.userId, {
						userId: entry.userId,
						name: entry.user.name,
						entries: 0,
						completed: 0,
						planned: 0,
						blockers: 0,
					});
				}
				const teamContributor = teamContributorMap.get(entry.userId)!;
				teamContributor.entries++;
				if (entry.type === "completed") teamContributor.completed++;
				else if (entry.type === "planned") teamContributor.planned++;
				else teamContributor.blockers++;

				if (!teamTaskSamplesMap.has(teamKey)) {
					teamTaskSamplesMap.set(teamKey, []);
				}
				const teamSamples = teamTaskSamplesMap.get(teamKey)!;
				if (teamSamples.length < 24) {
					teamSamples.push({
						date: entry.date,
						type: entry.type,
						content: entry.content,
						userId: entry.userId,
						userName: entry.user.name,
					});
				}

				if (!contributorTaskSamplesMap.has(entry.userId)) {
					contributorTaskSamplesMap.set(entry.userId, []);
				}
				const contributorSamples = contributorTaskSamplesMap.get(entry.userId)!;
				if (contributorSamples.length < 18) {
					contributorSamples.push({
						date: entry.date,
						type: entry.type,
						content: entry.content,
						teamId: entry.teamId,
						teamName: entry.team?.name ?? "GENERAL",
					});
				}

				if (!dailyContributorStatsMap.has(entry.date)) {
					dailyContributorStatsMap.set(entry.date, new Map());
				}
				const dailyContributorMap = dailyContributorStatsMap.get(entry.date)!;
				if (!dailyContributorMap.has(entry.userId)) {
					dailyContributorMap.set(entry.userId, {
						userId: entry.userId,
						name: entry.user.name,
						entries: 0,
						completed: 0,
						planned: 0,
						blockers: 0,
					});
				}
				const dailyContributor = dailyContributorMap.get(entry.userId)!;
				dailyContributor.entries++;
				if (entry.type === "completed") dailyContributor.completed++;
				else if (entry.type === "planned") dailyContributor.planned++;
				else dailyContributor.blockers++;

				if (!dailyTaskSamplesMap.has(entry.date)) {
					dailyTaskSamplesMap.set(entry.date, []);
				}
				const dailySamples = dailyTaskSamplesMap.get(entry.date)!;
				if (dailySamples.length < 20) {
					dailySamples.push({
						type: entry.type,
						content: entry.content,
						userId: entry.userId,
						userName: entry.user.name,
						teamId: entry.teamId,
						teamName: entry.team?.name ?? "GENERAL",
					});
				}

				for (const token of extractKeywordTokens(entry.content)) {
					if (!keywordDetailsMap.has(token)) {
						keywordDetailsMap.set(token, {
							count: 0,
							userIds: new Set(),
							samples: [],
						});
					}
					const keywordDetail = keywordDetailsMap.get(token)!;
					keywordDetail.count++;
					keywordDetail.userIds.add(entry.userId);
					if (keywordDetail.samples.length < 6) {
						keywordDetail.samples.push({
							date: entry.date,
							type: entry.type,
							content: entry.content,
							userId: entry.userId,
							userName: entry.user.name,
						});
					}
				}
			}

			const totalEntries = entries.length;
			const activeUsers = allUserIds.size;
			const participationRate =
				scopeMemberCount > 0 ? activeUsers / scopeMemberCount : 0;

			const dailyTrend = dateKeys.map((date) => {
				const day = dailyMap.get(date)!;
				const total = day.completed + day.planned + day.blockers;
				return {
					date,
					completed: day.completed,
					planned: day.planned,
					blockers: day.blockers,
					total,
					activeUsers: day.users.size,
				};
			});

			const teamStats = Array.from(teamStatsMap.values())
				.map((teamStat) => ({
					teamId: teamStat.teamId,
					teamName: teamStat.teamName,
					memberCount: teamStat.memberCount,
					activeUsers: teamStat.activeUsers.size,
					participationRate:
						teamStat.memberCount > 0
							? teamStat.activeUsers.size / teamStat.memberCount
							: 0,
					entries: teamStat.entries,
					completed: teamStat.completed,
					planned: teamStat.planned,
					blockers: teamStat.blockers,
					blockerRate:
						teamStat.entries > 0 ? teamStat.blockers / teamStat.entries : 0,
					velocity:
						teamStat.activeDays.size > 0
							? teamStat.completed / teamStat.activeDays.size
							: 0,
				}))
				.filter((teamStat) => teamStat.entries > 0)
				.sort((a, b) => b.entries - a.entries || b.activeUsers - a.activeUsers);

			const topContributors = Array.from(userStatsMap.values())
				.map((userStat) => ({
					userId: userStat.userId,
					name: userStat.name,
					entries: userStat.entries,
					completed: userStat.completed,
					planned: userStat.planned,
					blockers: userStat.blockers,
					daysPosted: userStat.days.size,
					teams: userStat.teamIds.size,
				}))
				.sort((a, b) => b.entries - a.entries || b.daysPosted - a.daysPosted)
				.slice(0, 12);

			const blockerHotspots = teamStats
				.filter((teamStat) => teamStat.entries >= 8)
				.sort(
					(a, b) => b.blockerRate - a.blockerRate || b.blockers - a.blockers,
				)
				.slice(0, 6);

			const keywords = extractTopKeywords(
				entries.map((entry) => entry.content),
				14,
			);

			const teamDrilldown = teamStats.map((teamStat) => {
				const teamKey = teamStat.teamId ?? "__GLOBAL__";
				const contributors = Array.from(
					(teamContributorStatsMap.get(teamKey) ?? new Map()).values(),
				)
					.sort((a, b) => b.entries - a.entries || b.completed - a.completed)
					.slice(0, 8);

				return {
					teamId: teamStat.teamId,
					teamName: teamStat.teamName,
					entries: teamStat.entries,
					completed: teamStat.completed,
					planned: teamStat.planned,
					blockers: teamStat.blockers,
					participationRate: teamStat.participationRate,
					blockerRate: teamStat.blockerRate,
					topContributors: contributors,
					sampleTasks: (teamTaskSamplesMap.get(teamKey) ?? []).slice(0, 12),
				};
			});

			const contributorDrilldown = Array.from(userStatsMap.values())
				.map((userStat) => ({
					userId: userStat.userId,
					name: userStat.name,
					entries: userStat.entries,
					completed: userStat.completed,
					planned: userStat.planned,
					blockers: userStat.blockers,
					daysPosted: userStat.days.size,
					teams: userStat.teamIds.size,
					sampleTasks: (
						contributorTaskSamplesMap.get(userStat.userId) ?? []
					).slice(0, 12),
				}))
				.sort((a, b) => b.entries - a.entries || b.daysPosted - a.daysPosted)
				.slice(0, 20);

			const dailyDrilldown = dailyTrend.map((day) => ({
				date: day.date,
				total: day.total,
				completed: day.completed,
				planned: day.planned,
				blockers: day.blockers,
				activeUsers: day.activeUsers,
				topContributors: Array.from(
					(dailyContributorStatsMap.get(day.date) ?? new Map()).values(),
				)
					.sort((a, b) => b.entries - a.entries || b.completed - a.completed)
					.slice(0, 6),
				sampleTasks: (dailyTaskSamplesMap.get(day.date) ?? []).slice(0, 10),
			}));

			const keywordDrilldown = keywords.map((keyword) => {
				const detail = keywordDetailsMap.get(keyword.term);
				return {
					term: keyword.term,
					count: keyword.count,
					uniquePeople: detail?.userIds.size ?? 0,
					samples: (detail?.samples ?? []).slice(0, 6),
				};
			});

			const recentWindow = Math.min(7, effectiveRangeDays);
			const recentSlice = dailyTrend.slice(-recentWindow);
			const previousSlice = dailyTrend.slice(
				-(recentWindow * 2),
				-recentWindow,
			);
			const sumBy = (
				rows: typeof dailyTrend,
				key: "completed" | "planned" | "blockers",
			) => rows.reduce((sum, row) => sum + row[key], 0);
			const recentCompleted = sumBy(recentSlice, "completed");
			const previousCompleted = sumBy(previousSlice, "completed");
			const recentBlockers = sumBy(recentSlice, "blockers");
			const previousBlockers = sumBy(previousSlice, "blockers");

			const completionDelta =
				previousCompleted === 0
					? recentCompleted > 0
						? 1
						: 0
					: (recentCompleted - previousCompleted) / previousCompleted;
			const blockerDelta =
				previousBlockers === 0
					? recentBlockers > 0
						? 1
						: 0
					: (recentBlockers - previousBlockers) / previousBlockers;

			return {
				period: {
					startDate,
					endDate,
					rangeDays: effectiveRangeDays,
				},
				scope: {
					teamId: input.teamId ?? null,
					teamName: selectedTeam?.name ?? null,
					members: scopeMemberCount,
					orgMembers: orgMembers.length,
				},
				totals: {
					entries: totalEntries,
					completed: totalCompleted,
					planned: totalPlanned,
					blockers: totalBlockers,
					blockerRate: totalEntries > 0 ? totalBlockers / totalEntries : 0,
					activeUsers,
					activeTeams: new Set(
						entries.map((entry) => entry.teamId ?? "__GLOBAL__"),
					).size,
					participationRate,
				},
				insights: {
					completionDelta,
					blockerDelta,
				},
				dailyTrend,
				dailyDrilldown,
				teamStats,
				teamDrilldown,
				topContributors,
				contributorDrilldown,
				blockerHotspots,
				keywords,
				keywordDrilldown,
			};
		}),

	getMine: orgProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(1000).default(30),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const orgId = ctx.organizationId;
			const { maxDays, floorDate } = await resolveHistoryWindow(orgId, userId);
			const effectiveLimit = Math.min(input?.limit ?? 30, maxDays);
			const conditions = [
				eq(standupEntry.userId, userId),
				eq(standupEntry.organizationId, orgId),
			];
			if (floorDate) {
				conditions.push(gte(standupEntry.date, floorDate));
			}

			const entries = await db.query.standupEntry.findMany({
				where: and(...conditions),
				orderBy: [desc(standupEntry.date), desc(standupEntry.createdAt)],
				limit: 10000,
			});

			// Group by date
			const grouped = new Map<
				string,
				{ completed: string[]; planned: string[]; blockers: string[] }
			>();

			for (const entry of entries) {
				if (!grouped.has(entry.date)) {
					grouped.set(entry.date, {
						completed: [],
						planned: [],
						blockers: [],
					});
				}
				const group = grouped.get(entry.date)!;
				if (entry.type === "completed") group.completed.push(entry.content);
				else if (entry.type === "planned") group.planned.push(entry.content);
				else if (entry.type === "blocker") group.blockers.push(entry.content);
			}

			const dates = Array.from(grouped.keys())
				.sort((a, b) => b.localeCompare(a))
				.slice(0, effectiveLimit);
			const activeShares =
				dates.length === 0
					? []
					: await db.query.standupShare.findMany({
							where: and(
								eq(standupShare.userId, userId),
								eq(standupShare.organizationId, orgId),
								isNull(standupShare.revokedAt),
								gte(standupShare.expiresAt, new Date()),
								inArray(standupShare.date, dates),
							),
							columns: { date: true, token: true },
						});
			const tokenByDate = new Map(
				activeShares.map((share) => [share.date, share.token]),
			);

			return dates.map((date) => ({
				date,
				sharedToken: tokenByDate.get(date) ?? null,
				...(grouped.get(date) ?? {
					completed: [],
					planned: [],
					blockers: [],
				}),
			}));
		}),

	createDayShare: orgProcedure
		.input(
			z.object({
				date: dateStringSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const orgId = ctx.organizationId;
			const hasEntries = await db.query.standupEntry.findFirst({
				where: and(
					eq(standupEntry.userId, userId),
					eq(standupEntry.organizationId, orgId),
					eq(standupEntry.date, input.date),
				),
				columns: { id: true },
			});

			if (!hasEntries) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No standup exists for this day.",
				});
			}

			const existingShare = await db.query.standupShare.findFirst({
				where: and(
					eq(standupShare.userId, userId),
					eq(standupShare.organizationId, orgId),
					eq(standupShare.date, input.date),
				),
				columns: { id: true, token: true, revokedAt: true, expiresAt: true },
			});

			if (
				existingShare &&
				existingShare.revokedAt === null &&
				existingShare.expiresAt !== null &&
				existingShare.expiresAt > new Date()
			) {
				return {
					token: existingShare.token,
					urlPath: `/share/${existingShare.token}`,
				};
			}

			const token = randomBytes(24).toString("base64url");
			const expiresAt = buildShareExpiryDate();
			if (existingShare) {
				await db
					.update(standupShare)
					.set({
						token,
						revokedAt: null,
						expiresAt,
					})
					.where(eq(standupShare.id, existingShare.id));
			} else {
				await db.insert(standupShare).values({
					token,
					userId,
					organizationId: orgId,
					date: input.date,
					expiresAt,
				});
			}

			return {
				token,
				urlPath: `/share/${token}`,
			};
		}),

	retractDayShare: orgProcedure
		.input(
			z.object({
				date: dateStringSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const rows = await db
				.update(standupShare)
				.set({
					revokedAt: new Date(),
				})
				.where(
					and(
						eq(standupShare.userId, ctx.session.user.id),
						eq(standupShare.organizationId, ctx.organizationId),
						eq(standupShare.date, input.date),
						isNull(standupShare.revokedAt),
					),
				)
				.returning({ id: standupShare.id });

			return { success: true, retracted: rows.length > 0 };
		}),

	getSharedByToken: publicProcedure
		.input(
			z.object({
				token: z.string().min(16),
			}),
		)
		.query(async ({ input }) => {
			const share = await db.query.standupShare.findFirst({
				where: and(
					eq(standupShare.token, input.token),
					isNull(standupShare.revokedAt),
					gte(standupShare.expiresAt, new Date()),
				),
				with: {
					user: {
						columns: { id: true, name: true, image: true },
					},
				},
			});

			if (!share) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "This shared standup is unavailable.",
				});
			}

			const entries = await db.query.standupEntry.findMany({
				where: and(
					eq(standupEntry.userId, share.userId),
					eq(standupEntry.organizationId, share.organizationId),
					eq(standupEntry.date, share.date),
				),
				orderBy: [desc(standupEntry.createdAt)],
			});

			return {
				date: share.date,
				user: share.user,
				...groupEntriesByType(entries),
			};
		}),

	hasSubmittedToday: orgProcedure
		.input(
			z.object({
				date: dateStringSchema.optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const today = input.date ?? new Date().toISOString().split("T")[0];
			const entry = await db.query.standupEntry.findFirst({
				where: and(
					eq(standupEntry.userId, ctx.session.user.id),
					eq(standupEntry.organizationId, ctx.organizationId),
					eq(standupEntry.date, today),
				),
			});
			return !!entry;
		}),

	getMyToday: orgProcedure
		.input(
			z.object({
				date: dateStringSchema.optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const today = input.date ?? new Date().toISOString().split("T")[0];
			const entries = await db.query.standupEntry.findMany({
				where: and(
					eq(standupEntry.userId, ctx.session.user.id),
					eq(standupEntry.organizationId, ctx.organizationId),
					eq(standupEntry.date, today),
				),
			});
			return entries;
		}),
};
