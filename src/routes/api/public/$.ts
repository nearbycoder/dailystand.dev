import { createFileRoute } from "@tanstack/react-router"
import { and, asc, desc, eq, gte, isNull, lte, or } from "drizzle-orm"
import { db } from "@/db"
import {
	member,
	standupEntry,
	team,
	teamMember,
	user,
} from "@/db/schema"
import { auth } from "@/lib/auth"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const RANGE_DAYS = new Set([7, 14, 30, 60, 90] as const)
const API_RESOURCE = "dailystand"

type ApiPermission =
	| "profile:read"
	| "teams:read"
	| "standups:read"
	| "standups:write"
	| "analytics:read"

type StandupType = "completed" | "planned" | "blocker"

class ApiHttpError extends Error {
	status: number
	code: string

	constructor(status: number, code: string, message: string) {
		super(message)
		this.status = status
		this.code = code
	}
}

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

function jsonResponse(status: number, payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...corsHeaders,
		},
	})
}

function ok(payload: unknown): Response {
	return jsonResponse(200, { success: true, data: payload })
}

function errorResponse(error: unknown): Response {
	if (error instanceof ApiHttpError) {
		return jsonResponse(error.status, {
			success: false,
			error: { code: error.code, message: error.message },
		})
	}
	return jsonResponse(500, {
		success: false,
		error: {
			code: "INTERNAL_ERROR",
			message: "An unexpected error occurred.",
		},
	})
}

function isoDate(date: Date): string {
	return date.toISOString().split("T")[0]
}

function parseDate(value: string, fieldName: string): string {
	if (!DATE_PATTERN.test(value)) {
		throw new ApiHttpError(
			400,
			"INVALID_DATE",
			`${fieldName} must be in YYYY-MM-DD format.`,
		)
	}
	return value
}

function parseRangeDays(value: string | null): 7 | 14 | 30 | 60 | 90 {
	if (!value) return 30
	const parsed = Number(value)
	if (RANGE_DAYS.has(parsed as 7 | 14 | 30 | 60 | 90)) {
		return parsed as 7 | 14 | 30 | 60 | 90
	}
	throw new ApiHttpError(
		400,
		"INVALID_RANGE",
		"rangeDays must be one of: 7, 14, 30, 60, 90.",
	)
}

function enumerateDateRange(startDate: Date, endDate: Date): string[] {
	const days: string[] = []
	const cursor = new Date(startDate)
	while (cursor <= endDate) {
		days.push(isoDate(cursor))
		cursor.setDate(cursor.getDate() + 1)
	}
	return days
}

function groupEntriesByType(entries: { type: StandupType; content: string }[]) {
	const grouped = {
		completed: [] as string[],
		planned: [] as string[],
		blockers: [] as string[],
	}
	for (const entry of entries) {
		if (entry.type === "completed") grouped.completed.push(entry.content)
		else if (entry.type === "planned") grouped.planned.push(entry.content)
		else grouped.blockers.push(entry.content)
	}
	return grouped
}

function chooseEntriesForTeam<T extends { teamId: string | null }>(
	entries: T[],
	teamId?: string,
) {
	if (!teamId) return entries
	const teamSpecific = entries.filter((entry) => entry.teamId === teamId)
	if (teamSpecific.length > 0) return teamSpecific
	return entries.filter((entry) => entry.teamId === null)
}

function extractTopKeywords(contents: string[], limit = 12) {
	const stopWords = new Set([
		"about",
		"after",
		"again",
		"between",
		"build",
		"done",
		"from",
		"have",
		"into",
		"next",
		"only",
		"plan",
		"review",
		"same",
		"standup",
		"team",
		"that",
		"this",
		"today",
		"update",
		"with",
		"work",
	])
	const counts = new Map<string, number>()
	for (const content of contents) {
		const cleaned = content
			.toLowerCase()
			.replace(/https?:\/\/\S+/g, " ")
			.replace(/www\.\S+/g, " ")
		for (const token of cleaned.split(/[^a-z0-9]+/g)) {
			if (token.length < 4) continue
			if (stopWords.has(token)) continue
			counts.set(token, (counts.get(token) ?? 0) + 1)
		}
	}
	return Array.from(counts.entries())
		.map(([term, count]) => ({ term, count }))
		.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
		.slice(0, limit)
}

function getApiKeyFromRequest(request: Request): string | null {
	const headerValue = request.headers.get("x-api-key")?.trim()
	if (headerValue) return headerValue

	const authorization = request.headers.get("authorization")?.trim()
	if (!authorization) return null
	if (!authorization.toLowerCase().startsWith("bearer ")) return null
	return authorization.slice(7).trim() || null
}

async function requireApiKeyAuth(request: Request, permission: ApiPermission) {
	const key = getApiKeyFromRequest(request)
	if (!key) {
		throw new ApiHttpError(
			401,
			"MISSING_API_KEY",
			"Missing API key. Provide it via x-api-key or Authorization: Bearer.",
		)
	}

	const verification = await auth.api.verifyApiKey({
		body: {
			key,
			permissions: {
				[API_RESOURCE]: [permission],
			},
		},
	})

	if (!verification.valid || !verification.key) {
		throw new ApiHttpError(401, "INVALID_API_KEY", "Invalid or unauthorized API key.")
	}

	const actor = await db.query.user.findFirst({
		where: eq(user.id, verification.key.userId),
		columns: { id: true, name: true, email: true, image: true },
	})

	if (!actor) {
		throw new ApiHttpError(
			401,
			"INVALID_API_KEY_USER",
			"The API key user is no longer valid.",
		)
	}

	return { actor, key: verification.key }
}

async function resolveOrganizationScope(userId: string, requestedOrgId: string | null) {
	const memberships = await db.query.member.findMany({
		where: eq(member.userId, userId),
		columns: { organizationId: true, role: true },
		with: {
			organization: {
				columns: { id: true, name: true, slug: true },
			},
		},
	})

	if (memberships.length === 0) {
		throw new ApiHttpError(
			403,
			"NO_ORGANIZATION_ACCESS",
			"This API key user is not a member of any organization.",
		)
	}

	if (requestedOrgId) {
		const matched = memberships.find(
			organizationMembership =>
				organizationMembership.organizationId === requestedOrgId,
		)
		if (!matched) {
			throw new ApiHttpError(
				403,
				"ORGANIZATION_FORBIDDEN",
				"This API key user does not belong to the requested orgId.",
			)
		}
		return matched.organization
	}

	if (memberships.length === 1) {
		return memberships[0]!.organization
	}

	throw new ApiHttpError(
		400,
		"ORG_REQUIRED",
		"This API key user belongs to multiple organizations. Pass orgId in the query/body.",
	)
}

async function assertTeamInOrganization(teamId: string, orgId: string) {
	const scopedTeam = await db.query.team.findFirst({
		where: and(eq(team.id, teamId), eq(team.organizationId, orgId)),
		columns: { id: true, name: true, organizationId: true },
	})
	if (!scopedTeam) {
		throw new ApiHttpError(
			404,
			"TEAM_NOT_FOUND",
			"Team was not found in the provided organization.",
		)
	}
	return scopedTeam
}

async function assertActorInTeam(
	userId: string,
	teamId: string,
	mode: "read" | "write" = "read",
) {
	const teamMembership = await db.query.teamMember.findFirst({
		where: and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)),
		columns: { id: true },
	})

	if (!teamMembership) {
		throw new ApiHttpError(
			403,
			mode === "write" ? "TEAM_FORBIDDEN" : "TEAM_READ_FORBIDDEN",
			mode === "write"
				? "You can only submit standups for teams you belong to."
				: "You can only read standups for teams you belong to.",
		)
	}
}

async function handleDocs(request: Request) {
	const baseUrl = new URL(request.url).origin
	return ok({
		name: "DailyStand Public API",
		version: "v1",
		baseUrl: `${baseUrl}/api/public/v1`,
		authentication: {
			type: "apiKey",
			header: "x-api-key",
			bearerSupported: true,
		},
		endpoints: {
			me: "GET /api/public/v1/me?orgId=<optional>",
			teams: "GET /api/public/v1/teams?orgId=<optional>",
			myTeams: "GET /api/public/v1/teams/mine?orgId=<optional>",
			standupsDay:
				"GET /api/public/v1/standups/day?date=YYYY-MM-DD&orgId=<optional>&teamId=<optional>",
			standupsHistory:
				"GET /api/public/v1/standups/history?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&orgId=<optional>&teamId=<optional>",
			standupsUpsert: "POST /api/public/v1/standups",
			analytics:
				"GET /api/public/v1/analytics?rangeDays=30&orgId=<optional>&teamId=<optional>",
		},
		permissionScopes: {
			resource: API_RESOURCE,
			actions: [
				"profile:read",
				"teams:read",
				"standups:read",
				"standups:write",
				"analytics:read",
			],
		},
	})
}

async function handleGetMe(request: Request) {
	const { actor, key } = await requireApiKeyAuth(request, "profile:read")
	const memberships = await db.query.member.findMany({
		where: eq(member.userId, actor.id),
		columns: { role: true, organizationId: true },
		with: {
			organization: {
				columns: { id: true, name: true, slug: true },
			},
		},
	})

	return ok({
		user: actor,
		apiKey: {
			id: key.id,
			name: key.name,
			prefix: key.prefix,
			start: key.start,
			expiresAt: key.expiresAt,
			enabled: key.enabled,
		},
		organizations: memberships.map((membership) => ({
			id: membership.organization.id,
			name: membership.organization.name,
			slug: membership.organization.slug,
			role: membership.role,
		})),
	})
}

async function handleGetTeams(request: Request, url: URL) {
	const { actor } = await requireApiKeyAuth(request, "teams:read")
	const org = await resolveOrganizationScope(actor.id, url.searchParams.get("orgId"))

	const teams = await db.query.team.findMany({
		where: eq(team.organizationId, org.id),
		columns: { id: true, name: true, createdAt: true },
		with: {
			teamMembers: {
				columns: { userId: true },
			},
		},
		orderBy: [asc(team.name)],
	})

	return ok({
		organization: org,
		teams: teams.map((orgTeam) => ({
			id: orgTeam.id,
			name: orgTeam.name,
			isMember: orgTeam.teamMembers.some(
				(teamMembership) => teamMembership.userId === actor.id,
			),
			memberCount: orgTeam.teamMembers.length,
			createdAt: orgTeam.createdAt,
		})),
	})
}

async function handleGetMyTeams(request: Request, url: URL) {
	const { actor } = await requireApiKeyAuth(request, "teams:read")
	const org = await resolveOrganizationScope(actor.id, url.searchParams.get("orgId"))

	const memberships = await db.query.teamMember.findMany({
		where: eq(teamMember.userId, actor.id),
		with: {
			team: {
				columns: { id: true, name: true, organizationId: true, createdAt: true },
				with: {
					teamMembers: {
						columns: { userId: true },
					},
				},
			},
		},
		orderBy: [asc(teamMember.createdAt)],
	})

	const teams = memberships
		.map((membership) => membership.team)
		.filter((membershipTeam) => membershipTeam.organizationId === org.id)

	return ok({
		organization: org,
		count: teams.length,
		teams: teams.map((membershipTeam) => ({
			id: membershipTeam.id,
			name: membershipTeam.name,
			isMember: true,
			memberCount: membershipTeam.teamMembers.length,
			createdAt: membershipTeam.createdAt,
		})),
	})
}

async function handleGetStandupsDay(request: Request, url: URL) {
	const { actor } = await requireApiKeyAuth(request, "standups:read")
	const org = await resolveOrganizationScope(actor.id, url.searchParams.get("orgId"))
	const teamId = url.searchParams.get("teamId")
	const date = parseDate(
		url.searchParams.get("date") ??
			isoDate(new Date(new Date().setHours(0, 0, 0, 0))),
		"date",
	)
	const teamScope = teamId ? await assertTeamInOrganization(teamId, org.id) : null
	if (teamScope) {
		await assertActorInTeam(actor.id, teamScope.id, "read")
	}

	const conditions = [eq(standupEntry.organizationId, org.id), eq(standupEntry.date, date)]
	if (teamScope) {
		const teamCondition = or(
			eq(standupEntry.teamId, teamScope.id),
			isNull(standupEntry.teamId),
		)
		if (teamCondition) conditions.push(teamCondition)
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

	const byUser = new Map<string, typeof entries>()
	for (const entry of entries) {
		if (!byUser.has(entry.userId)) byUser.set(entry.userId, [])
		byUser.get(entry.userId)!.push(entry)
	}

	const standups = Array.from(byUser.values()).map((userEntries) => {
		const selectedEntries = chooseEntriesForTeam(
			userEntries,
			teamScope ? teamScope.id : undefined,
		)
		const grouped = groupEntriesByType(selectedEntries)
		return {
			user: selectedEntries[0]?.user ?? userEntries[0]!.user,
			...grouped,
		}
	})

	return ok({
		organization: org,
		team: teamScope,
		date,
		count: standups.length,
		standups,
	})
}

async function handleGetStandupsHistory(request: Request, url: URL) {
	const { actor } = await requireApiKeyAuth(request, "standups:read")
	const org = await resolveOrganizationScope(actor.id, url.searchParams.get("orgId"))
	const startDate = parseDate(
		url.searchParams.get("startDate") ?? "",
		"startDate",
	)
	const endDate = parseDate(url.searchParams.get("endDate") ?? "", "endDate")
	const teamId = url.searchParams.get("teamId")
	const teamScope = teamId ? await assertTeamInOrganization(teamId, org.id) : null
	if (teamScope) {
		await assertActorInTeam(actor.id, teamScope.id, "read")
	}

	const conditions = [
		eq(standupEntry.organizationId, org.id),
		gte(standupEntry.date, startDate),
		lte(standupEntry.date, endDate),
	]
	if (teamScope) {
		const teamCondition = or(
			eq(standupEntry.teamId, teamScope.id),
			isNull(standupEntry.teamId),
		)
		if (teamCondition) conditions.push(teamCondition)
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

	const byDate = new Map<string, Map<string, typeof entries>>()
	for (const entry of entries) {
		if (!byDate.has(entry.date)) byDate.set(entry.date, new Map())
		const dateMap = byDate.get(entry.date)!
		if (!dateMap.has(entry.userId)) dateMap.set(entry.userId, [])
		dateMap.get(entry.userId)!.push(entry)
	}

	const history = Array.from(byDate.entries())
		.sort((a, b) => b[0].localeCompare(a[0]))
		.map(([date, usersMap]) => ({
			date,
			standups: Array.from(usersMap.values()).map((userEntries) => {
				const selectedEntries = chooseEntriesForTeam(
					userEntries,
					teamScope ? teamScope.id : undefined,
				)
				return {
					user: selectedEntries[0]?.user ?? userEntries[0]!.user,
					...groupEntriesByType(selectedEntries),
				}
			}),
		}))

	return ok({
		organization: org,
		team: teamScope,
		startDate,
		endDate,
		days: history.length,
		history,
	})
}

type StandupCreateBody = {
	orgId?: string
	date?: string
	teamId?: string | null
	entries?: { type: StandupType; content: string }[]
}

async function handlePostStandups(request: Request) {
	const { actor } = await requireApiKeyAuth(request, "standups:write")

	let body: StandupCreateBody
	try {
		body = (await request.json()) as StandupCreateBody
	} catch {
		throw new ApiHttpError(
			400,
			"INVALID_JSON",
			"Request body must be valid JSON.",
		)
	}

	const date = parseDate(body.date ?? "", "date")
	const entries = Array.isArray(body.entries) ? body.entries : []
	for (const [index, entry] of entries.entries()) {
		if (
			!entry ||
			(entry.type !== "completed" &&
				entry.type !== "planned" &&
				entry.type !== "blocker")
		) {
			throw new ApiHttpError(
				400,
				"INVALID_ENTRY",
				`entries[${index}].type must be completed, planned, or blocker.`,
			)
		}
		if (!entry.content?.trim()) {
			throw new ApiHttpError(
				400,
				"INVALID_ENTRY",
				`entries[${index}].content is required.`,
			)
		}
	}

	const org = await resolveOrganizationScope(actor.id, body.orgId ?? null)
	const targetTeamId = body.teamId ?? null
	if (targetTeamId) {
		await assertTeamInOrganization(targetTeamId, org.id)
		await assertActorInTeam(actor.id, targetTeamId, "write")
	}

	await db
		.delete(standupEntry)
		.where(
			and(
				eq(standupEntry.userId, actor.id),
				eq(standupEntry.organizationId, org.id),
				eq(standupEntry.date, date),
				targetTeamId
					? eq(standupEntry.teamId, targetTeamId)
					: isNull(standupEntry.teamId),
			),
		)

	if (entries.length > 0) {
		await db.insert(standupEntry).values(
			entries.map((entry) => ({
				userId: actor.id,
				organizationId: org.id,
				teamId: targetTeamId,
				date,
				type: entry.type,
				content: entry.content.trim(),
			})),
		)
	}

	return ok({
		organization: org,
		date,
		teamId: targetTeamId,
		writtenEntries: entries.length,
	})
}

async function handleGetAnalytics(request: Request, url: URL) {
	const { actor } = await requireApiKeyAuth(request, "analytics:read")
	const org = await resolveOrganizationScope(actor.id, url.searchParams.get("orgId"))
	const teamId = url.searchParams.get("teamId")
	const rangeDays = parseRangeDays(url.searchParams.get("rangeDays"))
	const scopedTeam = teamId ? await assertTeamInOrganization(teamId, org.id) : null

	const endDateObj = new Date()
	endDateObj.setHours(0, 0, 0, 0)
	const startDateObj = new Date(endDateObj)
	startDateObj.setDate(startDateObj.getDate() - (rangeDays - 1))
	const startDate = isoDate(startDateObj)
	const endDate = isoDate(endDateObj)

	const conditions = [
		eq(standupEntry.organizationId, org.id),
		gte(standupEntry.date, startDate),
		lte(standupEntry.date, endDate),
	]
	if (scopedTeam) {
		conditions.push(eq(standupEntry.teamId, scopedTeam.id))
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
	})

	const dateKeys = enumerateDateRange(startDateObj, endDateObj)
	const dailyMap = new Map(
		dateKeys.map((date) => [
			date,
			{
				completed: 0,
				planned: 0,
				blockers: 0,
				activeUsers: new Set<string>(),
			},
		]),
	)

	const teamStatsMap = new Map<
		string,
		{
			teamId: string | null
			teamName: string
			entries: number
			completed: number
			planned: number
			blockers: number
			activeUsers: Set<string>
		}
	>()

	const userStats = new Map<
		string,
		{
			userId: string
			name: string
			entries: number
			completed: number
			planned: number
			blockers: number
			days: Set<string>
		}
	>()

	let totalCompleted = 0
	let totalPlanned = 0
	let totalBlockers = 0
	const activeUsers = new Set<string>()

	for (const entry of entries) {
		const day = dailyMap.get(entry.date)
		if (day) {
			day.activeUsers.add(entry.userId)
			if (entry.type === "completed") day.completed++
			else if (entry.type === "planned") day.planned++
			else day.blockers++
		}

		if (entry.type === "completed") totalCompleted++
		else if (entry.type === "planned") totalPlanned++
		else totalBlockers++
		activeUsers.add(entry.userId)

		const teamKey = entry.teamId ?? "__GLOBAL__"
		if (!teamStatsMap.has(teamKey)) {
			teamStatsMap.set(teamKey, {
				teamId: entry.teamId,
				teamName: entry.team?.name ?? "GENERAL",
				entries: 0,
				completed: 0,
				planned: 0,
				blockers: 0,
				activeUsers: new Set(),
			})
		}

		const teamStats = teamStatsMap.get(teamKey)!
		teamStats.entries++
		teamStats.activeUsers.add(entry.userId)
		if (entry.type === "completed") teamStats.completed++
		else if (entry.type === "planned") teamStats.planned++
		else teamStats.blockers++

		if (!userStats.has(entry.userId)) {
			userStats.set(entry.userId, {
				userId: entry.user.id,
				name: entry.user.name,
				entries: 0,
				completed: 0,
				planned: 0,
				blockers: 0,
				days: new Set(),
			})
		}
		const contributor = userStats.get(entry.userId)!
		contributor.entries++
		contributor.days.add(entry.date)
		if (entry.type === "completed") contributor.completed++
		else if (entry.type === "planned") contributor.planned++
		else contributor.blockers++
	}

	const scopeMembers = scopedTeam
		? (
				await db.query.teamMember.findMany({
					where: eq(teamMember.teamId, scopedTeam.id),
					columns: { userId: true },
				})
			).length
		: (
				await db.query.member.findMany({
					where: eq(member.organizationId, org.id),
					columns: { userId: true },
				})
			).length

	const daily = dateKeys.map((date) => {
		const day = dailyMap.get(date)!
		const total = day.completed + day.planned + day.blockers
		return {
			date,
			completed: day.completed,
			planned: day.planned,
			blockers: day.blockers,
			total,
			activeUsers: day.activeUsers.size,
		}
	})

	const teams = Array.from(teamStatsMap.values())
		.map((teamStats) => ({
			teamId: teamStats.teamId,
			teamName: teamStats.teamName,
			entries: teamStats.entries,
			completed: teamStats.completed,
			planned: teamStats.planned,
			blockers: teamStats.blockers,
			activeUsers: teamStats.activeUsers.size,
			blockerRate:
				teamStats.entries > 0 ? teamStats.blockers / teamStats.entries : 0,
		}))
		.sort((a, b) => b.entries - a.entries)

	const topContributors = Array.from(userStats.values())
		.map((contributor) => ({
			userId: contributor.userId,
			name: contributor.name,
			entries: contributor.entries,
			completed: contributor.completed,
			planned: contributor.planned,
			blockers: contributor.blockers,
			daysPosted: contributor.days.size,
		}))
		.sort((a, b) => b.entries - a.entries || b.daysPosted - a.daysPosted)
		.slice(0, 12)

	return ok({
		period: { startDate, endDate, rangeDays },
		scope: {
			organizationId: org.id,
			organizationName: org.name,
			organizationSlug: org.slug,
			teamId: scopedTeam?.id ?? null,
			teamName: scopedTeam?.name ?? null,
			members: scopeMembers,
		},
		totals: {
			entries: entries.length,
			completed: totalCompleted,
			planned: totalPlanned,
			blockers: totalBlockers,
			blockerRate: entries.length > 0 ? totalBlockers / entries.length : 0,
			activeUsers: activeUsers.size,
			participationRate: scopeMembers > 0 ? activeUsers.size / scopeMembers : 0,
		},
		daily,
		teams,
		topContributors,
		keywords: extractTopKeywords(entries.map((entry) => entry.content), 14),
	})
}

async function routeGet(request: Request): Promise<Response> {
	const url = new URL(request.url)
	const path = url.pathname.replace(/^\/api\/public\/?/, "")
	const segments = path.split("/").filter(Boolean)

	if (segments.length === 0 || (segments.length === 1 && segments[0] === "v1")) {
		return handleDocs(request)
	}

	if (segments[0] !== "v1") {
		throw new ApiHttpError(404, "NOT_FOUND", "Unknown API version.")
	}

	if (segments[1] === "me" && segments.length === 2) {
		return handleGetMe(request)
	}
	if (segments[1] === "teams" && segments.length === 2) {
		return handleGetTeams(request, url)
	}
	if (segments[1] === "teams" && segments[2] === "mine" && segments.length === 3) {
		return handleGetMyTeams(request, url)
	}
	if (segments[1] === "standups" && segments[2] === "day") {
		return handleGetStandupsDay(request, url)
	}
	if (segments[1] === "standups" && segments[2] === "history") {
		return handleGetStandupsHistory(request, url)
	}
	if (segments[1] === "analytics" && segments.length === 2) {
		return handleGetAnalytics(request, url)
	}

	throw new ApiHttpError(404, "NOT_FOUND", "Endpoint not found.")
}

async function routePost(request: Request): Promise<Response> {
	const url = new URL(request.url)
	const path = url.pathname.replace(/^\/api\/public\/?/, "")
	const segments = path.split("/").filter(Boolean)

	if (segments[0] === "v1" && segments[1] === "standups" && segments.length === 2) {
		return handlePostStandups(request)
	}

	throw new ApiHttpError(404, "NOT_FOUND", "Endpoint not found.")
}

async function withErrorHandling(handler: () => Promise<Response>) {
	try {
		return await handler()
	} catch (error) {
		return errorResponse(error)
	}
}

function optionsHandler() {
	return new Response(null, {
		status: 204,
		headers: corsHeaders,
	})
}

export const Route = createFileRoute("/api/public/$")({
	server: {
		handlers: {
			GET: ({ request }) => withErrorHandling(() => routeGet(request)),
			POST: ({ request }) => withErrorHandling(() => routePost(request)),
			OPTIONS: () => optionsHandler(),
		},
	},
})
