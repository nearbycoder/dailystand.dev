import { z } from "zod"
import { orgProcedure } from "../init"
import { db } from "@/db"
import { standupEntry } from "@/db/schema"
import { and, eq, desc, gte, lte } from "drizzle-orm"

export const standupsRouter = {
	upsert: orgProcedure
		.input(
			z.object({
				date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
				teamId: z.string().nullable().optional(),
				entries: z.array(
					z.object({
						type: z.enum(["completed", "planned", "blocker"]),
						content: z.string().min(1),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id
			const orgId = ctx.organizationId

			await db
				.delete(standupEntry)
				.where(
					and(
						eq(standupEntry.userId, userId),
						eq(standupEntry.organizationId, orgId),
						eq(standupEntry.date, input.date),
					),
				)

			if (input.entries.length === 0) return { success: true }

			await db.insert(standupEntry).values(
				input.entries.map((entry) => ({
					userId,
					organizationId: orgId,
					teamId: input.teamId ?? null,
					date: input.date,
					type: entry.type,
					content: entry.content,
				})),
			)

			return { success: true }
		}),

	getByDate: orgProcedure
		.input(
			z.object({
				date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
				teamId: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
				eq(standupEntry.organizationId, ctx.organizationId),
				eq(standupEntry.date, input.date),
			]
			if (input.teamId) {
				conditions.push(eq(standupEntry.teamId, input.teamId))
			}

			const entries = await db.query.standupEntry.findMany({
				where: and(...conditions),
				with: {
					user: {
						columns: { id: true, name: true, image: true },
					},
				},
				orderBy: [desc(standupEntry.createdAt)],
			})

			// Group by user
			const grouped = new Map<
				string,
				{
					user: { id: string; name: string; image: string | null }
					completed: string[]
					planned: string[]
					blockers: string[]
				}
			>()

			for (const entry of entries) {
				if (!grouped.has(entry.userId)) {
					grouped.set(entry.userId, {
						user: entry.user,
						completed: [],
						planned: [],
						blockers: [],
					})
				}
				const group = grouped.get(entry.userId)!
				if (entry.type === "completed") group.completed.push(entry.content)
				else if (entry.type === "planned") group.planned.push(entry.content)
				else if (entry.type === "blocker") group.blockers.push(entry.content)
			}

			return Array.from(grouped.values())
		}),

	getByDateRange: orgProcedure
		.input(
			z.object({
				startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
				endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
				teamId: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
				eq(standupEntry.organizationId, ctx.organizationId),
				gte(standupEntry.date, input.startDate),
				lte(standupEntry.date, input.endDate),
			]
			if (input.teamId) {
				conditions.push(eq(standupEntry.teamId, input.teamId))
			}

			const entries = await db.query.standupEntry.findMany({
				where: and(...conditions),
				with: {
					user: {
						columns: { id: true, name: true, image: true },
					},
				},
				orderBy: [desc(standupEntry.date), desc(standupEntry.createdAt)],
			})

			// Group by date, then by user
			const byDate = new Map<
				string,
				Map<
					string,
					{
						user: { id: string; name: string; image: string | null }
						completed: string[]
						planned: string[]
						blockers: string[]
					}
				>
			>()

			for (const entry of entries) {
				if (!byDate.has(entry.date)) {
					byDate.set(entry.date, new Map())
				}
				const dateMap = byDate.get(entry.date)!
				if (!dateMap.has(entry.userId)) {
					dateMap.set(entry.userId, {
						user: entry.user,
						completed: [],
						planned: [],
						blockers: [],
					})
				}
				const group = dateMap.get(entry.userId)!
				if (entry.type === "completed") group.completed.push(entry.content)
				else if (entry.type === "planned") group.planned.push(entry.content)
				else if (entry.type === "blocker") group.blockers.push(entry.content)
			}

			return Array.from(byDate.entries()).map(([date, usersMap]) => ({
				date,
				standups: Array.from(usersMap.values()),
			}))
		}),

	getMine: orgProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(100).default(30),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const entries = await db.query.standupEntry.findMany({
				where: and(
					eq(standupEntry.userId, ctx.session.user.id),
					eq(standupEntry.organizationId, ctx.organizationId),
				),
				orderBy: [desc(standupEntry.date), desc(standupEntry.createdAt)],
				limit: input?.limit ?? 30,
			})

			// Group by date
			const grouped = new Map<
				string,
				{ completed: string[]; planned: string[]; blockers: string[] }
			>()

			for (const entry of entries) {
				if (!grouped.has(entry.date)) {
					grouped.set(entry.date, {
						completed: [],
						planned: [],
						blockers: [],
					})
				}
				const group = grouped.get(entry.date)!
				if (entry.type === "completed") group.completed.push(entry.content)
				else if (entry.type === "planned") group.planned.push(entry.content)
				else if (entry.type === "blocker") group.blockers.push(entry.content)
			}

			return Array.from(grouped.entries()).map(([date, data]) => ({
				date,
				...data,
			}))
		}),

	hasSubmittedToday: orgProcedure.query(async ({ ctx }) => {
		const today = new Date().toISOString().split("T")[0]
		const entry = await db.query.standupEntry.findFirst({
			where: and(
				eq(standupEntry.userId, ctx.session.user.id),
				eq(standupEntry.organizationId, ctx.organizationId),
				eq(standupEntry.date, today),
			),
		})
		return !!entry
	}),

	getMyToday: orgProcedure.query(async ({ ctx }) => {
		const today = new Date().toISOString().split("T")[0]
		const entries = await db.query.standupEntry.findMany({
			where: and(
				eq(standupEntry.userId, ctx.session.user.id),
				eq(standupEntry.organizationId, ctx.organizationId),
				eq(standupEntry.date, today),
			),
		})
		return entries
	}),
}
