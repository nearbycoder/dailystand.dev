import { TRPCError } from "@trpc/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { member, standupEntry, teamMember, user } from "@/db/schema";
import { orgProcedure } from "../init";

const dateCursorSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function normalizeBioInput(bio: string | null | undefined) {
	const trimmed = bio?.trim() ?? "";
	return trimmed.length > 0 ? trimmed : null;
}

function groupProfileStandupEntries(
	entries: Array<{
		id: number;
		date: string;
		type: "completed" | "planned" | "blocker";
		content: string;
		teamId: string | null;
		createdAt: Date;
		team: { id: string; name: string } | null;
	}>,
) {
	const byDate = new Map<
		string,
		{
			date: string;
			completed: string[];
			planned: string[];
			blockers: string[];
			entries: Array<{
				id: number;
				type: "completed" | "planned" | "blocker";
				content: string;
				teamId: string | null;
				teamName: string | null;
				createdAt: Date;
			}>;
		}
	>();

	for (const entry of entries) {
		if (!byDate.has(entry.date)) {
			byDate.set(entry.date, {
				date: entry.date,
				completed: [],
				planned: [],
				blockers: [],
				entries: [],
			});
		}
		const day = byDate.get(entry.date);
		if (!day) continue;
		day.entries.push({
			id: entry.id,
			type: entry.type,
			content: entry.content,
			teamId: entry.teamId,
			teamName: entry.team?.name ?? null,
			createdAt: entry.createdAt,
		});

		if (entry.type === "completed") day.completed.push(entry.content);
		else if (entry.type === "planned") day.planned.push(entry.content);
		else day.blockers.push(entry.content);
	}

	return Array.from(byDate.values());
}

export const profileRouter = {
	getUserProfile: orgProcedure
		.input(
			z.object({
				userId: z.string().min(1),
				limit: z.number().int().min(1).max(90).default(30),
				cursorDate: dateCursorSchema.optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const [viewerMembership, targetMembership, targetUser] = await Promise.all([
				db.query.member.findFirst({
					where: and(
						eq(member.organizationId, ctx.organizationId),
						eq(member.userId, ctx.session.user.id),
					),
					columns: { id: true },
				}),
				db.query.member.findFirst({
					where: and(
						eq(member.organizationId, ctx.organizationId),
						eq(member.userId, input.userId),
					),
					columns: { role: true, createdAt: true },
				}),
				db.query.user.findFirst({
					where: eq(user.id, input.userId),
					columns: {
						id: true,
						name: true,
						image: true,
						bio: true,
						createdAt: true,
					},
				}),
			]);

			if (!viewerMembership) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You are not a member of this organization.",
				});
			}
			if (!targetMembership || !targetUser) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "User not found in this organization.",
				});
			}

			const teamMembershipRows = await db.query.teamMember.findMany({
				where: eq(teamMember.userId, input.userId),
				columns: {
					id: true,
					teamId: true,
					createdAt: true,
				},
				with: {
					team: {
						columns: {
							id: true,
							name: true,
							organizationId: true,
						},
					},
				},
			});

			const baseConditions = [
				eq(standupEntry.organizationId, ctx.organizationId),
				eq(standupEntry.userId, input.userId),
			];

			const historyConditions = [...baseConditions];
			if (input.cursorDate) {
				historyConditions.push(lt(standupEntry.date, input.cursorDate));
			}

			const entryFetchLimit = Math.min(input.limit * 12, 2000);
			const entries = await db.query.standupEntry.findMany({
				where: and(...historyConditions),
				columns: {
					id: true,
					date: true,
					type: true,
					content: true,
					teamId: true,
					createdAt: true,
				},
				with: {
					team: {
						columns: { id: true, name: true },
					},
				},
				orderBy: [desc(standupEntry.date), desc(standupEntry.createdAt)],
				limit: entryFetchLimit,
			});

			const groupedHistory = groupProfileStandupEntries(entries);
			const days = groupedHistory.slice(0, input.limit);
			const provisionalCursor =
				days.length === input.limit ? days[days.length - 1]?.date ?? null : null;

			let hasMore = false;
			let nextCursorDate: string | null = null;
			if (provisionalCursor) {
				const olderEntry = await db.query.standupEntry.findFirst({
					where: and(...baseConditions, lt(standupEntry.date, provisionalCursor)),
					columns: { id: true },
				});
				hasMore = Boolean(olderEntry);
				nextCursorDate = hasMore ? provisionalCursor : null;
			}

			return {
				user: targetUser,
				organizationMembership: {
					role: targetMembership.role,
					joinedAt: targetMembership.createdAt,
				},
				teamMemberships: teamMembershipRows
					.filter((row) => row.team.organizationId === ctx.organizationId)
					.map((row) => ({
						id: row.id,
						teamId: row.team.id,
						teamName: row.team.name,
						joinedAt: row.createdAt,
					}))
					.sort((a, b) => a.teamName.localeCompare(b.teamName)),
				history: {
					days,
					nextCursorDate,
					hasMore,
				},
			};
		}),

	updateMyBio: orgProcedure
		.input(
			z.object({
				bio: z.string().max(500).nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const currentMembership = await db.query.member.findFirst({
				where: and(
					eq(member.organizationId, ctx.organizationId),
					eq(member.userId, ctx.session.user.id),
				),
				columns: { id: true },
			});

			if (!currentMembership) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You are not a member of this organization.",
				});
			}

			const bio = normalizeBioInput(input.bio);
			await db
				.update(user)
				.set({
					bio,
					updatedAt: new Date(),
				})
				.where(eq(user.id, ctx.session.user.id));

			return { bio };
		}),
};
