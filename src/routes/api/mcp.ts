import { randomBytes } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { member, standupEntry, team, teamMember, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
	countOrganizationMembers,
	countTeamMembers,
	getHistoryFloorDate,
	resolveOrganizationPlanLimits,
} from "@/lib/plan-limits";

const API_RESOURCE = "dailystand";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ApiPermission =
	| "profile:read"
	| "teams:read"
	| "members:manage"
	| "standups:read"
	| "standups:write"
	| "analytics:read";

type JsonRpcId = string | number | null;

type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
	structuredContent?: unknown;
};

type Actor = {
	id: string;
	name: string;
	email: string;
	image: string | null;
	key: {
		id: string;
		name: string | null;
		prefix: string | null;
		start: string | null;
		expiresAt: Date | null;
	};
};

class McpError extends Error {
	status: number;
	code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

function parseCsvEnv(value?: string): string[] {
	return (value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

const allowedCorsOrigins = new Set([
	...parseCsvEnv(process.env.API_ALLOWED_ORIGINS),
	...parseCsvEnv(process.env.BETTER_AUTH_URL),
]);

function isCorsOriginAllowed(origin: string | null): boolean {
	if (!origin) return true;
	return allowedCorsOrigins.has(origin);
}

function buildCorsHeaders(origin: string | null) {
	const headers: Record<string, string> = {
		"Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	};
	if (origin && isCorsOriginAllowed(origin)) {
		headers["Access-Control-Allow-Origin"] = origin;
		headers.Vary = "Origin";
	}
	return headers;
}

const jsonRpcRequestSchema = z.object({
	jsonrpc: z.literal("2.0"),
	id: z.union([z.string(), z.number(), z.null()]).optional(),
	method: z.string(),
	params: z.unknown().optional(),
});

const toolsCallParamsSchema = z.object({
	name: z.string(),
	arguments: z.record(z.string(), z.unknown()).optional(),
});

function isoDate(date: Date): string {
	return date.toISOString().split("T")[0];
}

function getApiKeyFromRequest(request: Request): string | null {
	const direct = request.headers.get("x-api-key")?.trim();
	if (direct) return direct;

	const authorization = request.headers.get("authorization")?.trim();
	if (!authorization) return null;
	if (!authorization.toLowerCase().startsWith("bearer ")) return null;
	return authorization.slice(7).trim() || null;
}

function randomId(): string {
	return randomBytes(16).toString("hex");
}

function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});
}

function noContentResponse(): Response {
	return new Response(null, { status: 204 });
}

function rpcSuccess(id: JsonRpcId, result: unknown) {
	return {
		jsonrpc: "2.0" as const,
		id,
		result,
	};
}

function rpcError(
	id: JsonRpcId,
	code: number,
	message: string,
	data?: unknown,
) {
	return {
		jsonrpc: "2.0" as const,
		id,
		error: {
			code,
			message,
			...(data === undefined ? {} : { data }),
		},
	};
}

function toolResult(data: unknown): ToolResult {
	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(data, null, 2),
			},
		],
		structuredContent: data,
	};
}

function toolErrorResult(error: unknown): ToolResult {
	if (error instanceof McpError) {
		return {
			isError: true,
			content: [{ type: "text", text: error.message }],
			structuredContent: {
				code: error.code,
				status: error.status,
			},
		};
	}
	return {
		isError: true,
		content: [{ type: "text", text: "Unexpected server error." }],
	};
}

function assertDate(value: string): string {
	if (!DATE_PATTERN.test(value)) {
		throw new McpError(400, "INVALID_DATE", "Date must be YYYY-MM-DD.");
	}
	return value;
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

function groupEntriesByType(
	entries: Array<{
		type: "completed" | "planned" | "blocker";
		content: string;
	}>,
) {
	const grouped = {
		completed: [] as string[],
		planned: [] as string[],
		blockers: [] as string[],
	};
	for (const entry of entries) {
		if (entry.type === "completed") grouped.completed.push(entry.content);
		else if (entry.type === "planned") grouped.planned.push(entry.content);
		else grouped.blockers.push(entry.content);
	}
	return grouped;
}

async function requireActor(
	request: Request,
	requiredPermission?: ApiPermission,
): Promise<Actor> {
	const key = getApiKeyFromRequest(request);
	if (!key) {
		throw new McpError(
			401,
			"MISSING_API_KEY",
			"Missing API key. Use x-api-key or Authorization: Bearer.",
		);
	}

	const verification = await auth.api.verifyApiKey({
		body: requiredPermission
			? {
					key,
					permissions: {
						[API_RESOURCE]: [requiredPermission],
					},
				}
			: { key },
	});

	if (!verification.valid || !verification.key) {
		throw new McpError(
			401,
			"INVALID_API_KEY",
			"Invalid or unauthorized API key.",
		);
	}

	const actor = await db.query.user.findFirst({
		where: eq(user.id, verification.key.userId),
		columns: { id: true, name: true, email: true, image: true },
	});

	if (!actor) {
		throw new McpError(
			401,
			"INVALID_API_KEY_USER",
			"The user associated with this key no longer exists.",
		);
	}

	return {
		...actor,
		key: {
			id: verification.key.id,
			name: verification.key.name,
			prefix: verification.key.prefix,
			start: verification.key.start,
			expiresAt: verification.key.expiresAt,
		},
	};
}

async function resolveOrganizationScope(userId: string, orgId?: string) {
	const memberships = await db.query.member.findMany({
		where: eq(member.userId, userId),
		columns: { organizationId: true, role: true },
		with: {
			organization: {
				columns: { id: true, name: true, slug: true },
			},
		},
	});

	if (memberships.length === 0) {
		throw new McpError(
			403,
			"NO_ORG_ACCESS",
			"This user is not a member of any organization.",
		);
	}

	if (orgId) {
		const membership = memberships.find((row) => row.organizationId === orgId);
		if (!membership) {
			throw new McpError(
				403,
				"ORG_FORBIDDEN",
				"This user does not belong to the requested organization.",
			);
		}
		return {
			organization: membership.organization,
			role: membership.role,
		};
	}

	if (memberships.length > 1) {
		throw new McpError(
			400,
			"ORG_REQUIRED",
			"This user belongs to multiple orgs. Pass orgId.",
		);
	}

	const [membership] = memberships;
	if (!membership) {
		throw new McpError(
			403,
			"NO_ORG_ACCESS",
			"This user is not a member of any organization.",
		);
	}
	return {
		organization: membership.organization,
		role: membership.role,
	};
}

async function assertOwnerRole(userId: string, orgId: string) {
	const orgMember = await db.query.member.findFirst({
		where: and(eq(member.userId, userId), eq(member.organizationId, orgId)),
		columns: { role: true },
	});
	if (!orgMember || orgMember.role !== "owner") {
		throw new McpError(
			403,
			"OWNER_REQUIRED",
			"Only organization owners can perform this action.",
		);
	}
}

async function assertTeamInOrganization(teamId: string, orgId: string) {
	const targetTeam = await db.query.team.findFirst({
		where: and(eq(team.id, teamId), eq(team.organizationId, orgId)),
		columns: { id: true, name: true, organizationId: true },
	});
	if (!targetTeam) {
		throw new McpError(
			404,
			"TEAM_NOT_FOUND",
			"Team not found in the specified organization.",
		);
	}
	return targetTeam;
}

async function assertUserInOrganization(targetUserId: string, orgId: string) {
	const orgMember = await db.query.member.findFirst({
		where: and(
			eq(member.userId, targetUserId),
			eq(member.organizationId, orgId),
		),
		columns: { id: true, role: true },
		with: {
			user: {
				columns: { id: true, name: true, email: true, image: true },
			},
		},
	});
	if (!orgMember) {
		throw new McpError(
			404,
			"ORG_MEMBER_NOT_FOUND",
			"User is not a member of the organization.",
		);
	}
	return orgMember;
}

async function assertActorInTeam(
	actorId: string,
	teamId: string,
	mode: "read" | "write" = "read",
) {
	const existing = await db.query.teamMember.findFirst({
		where: and(eq(teamMember.teamId, teamId), eq(teamMember.userId, actorId)),
		columns: { id: true },
	});
	if (!existing) {
		throw new McpError(
			403,
			mode === "write" ? "TEAM_SUBMIT_FORBIDDEN" : "TEAM_READ_FORBIDDEN",
			mode === "write"
				? "You can only submit standups to teams you belong to."
				: "You can only read standups for teams you belong to.",
		);
	}
}

async function resolvePlanLimitsForScope(
	organizationId: string,
	userId: string,
) {
	return resolveOrganizationPlanLimits({
		organizationId,
		userId,
	});
}

async function assertOrganizationMemberLimit(
	organizationId: string,
	userId: string,
) {
	const resolved = await resolvePlanLimitsForScope(organizationId, userId);
	if (resolved.limits.members < 0) return;

	const orgMemberCount = await countOrganizationMembers(organizationId);
	if (orgMemberCount >= resolved.limits.members) {
		throw new McpError(
			403,
			"ORG_MEMBER_LIMIT_REACHED",
			`Plan member limit reached (${resolved.limits.members}).`,
		);
	}
}

async function assertTeamMemberLimit(
	organizationId: string,
	teamId: string,
	userId: string,
) {
	const resolved = await resolvePlanLimitsForScope(organizationId, userId);
	if (resolved.limits.members < 0) return;

	const currentTeamSize = await countTeamMembers(teamId, organizationId);
	if (currentTeamSize >= resolved.limits.members) {
		throw new McpError(
			403,
			"TEAM_MEMBER_LIMIT_REACHED",
			`Team member limit reached (${resolved.limits.members}).`,
		);
	}
}

async function resolveHistoryConstraints(
	organizationId: string,
	userId: string,
) {
	const resolved = await resolvePlanLimitsForScope(organizationId, userId);
	const maxDays =
		resolved.limits.historyDays < 0
			? Number.MAX_SAFE_INTEGER
			: resolved.limits.historyDays;
	return {
		maxDays,
		floorDate: getHistoryFloorDate(resolved.limits.historyDays),
	};
}

const orgIdSchema = z.object({
	orgId: z.string().optional(),
});

const dateInputSchema = z
	.string()
	.regex(DATE_PATTERN, "Date must be YYYY-MM-DD.");

const addOrganizationMemberSchema = orgIdSchema.extend({
	email: z.string().email(),
	role: z.enum(["member", "admin"]).optional().default("member"),
});

const assignUserToTeamSchema = orgIdSchema.extend({
	teamId: z.string(),
	userId: z.string(),
});

const getStandupSchema = orgIdSchema.extend({
	date: dateInputSchema.optional(),
	teamId: z.string().optional(),
});

const standupSubmitSchema = orgIdSchema.extend({
	date: dateInputSchema.optional(),
	teamId: z.string().nullable().optional(),
	completed: z.array(z.string()).optional().default([]),
	planned: z.array(z.string()).optional().default([]),
	blockers: z.array(z.string()).optional().default([]),
});

const getStandupHistorySchema = orgIdSchema.extend({
	limit: z.number().int().min(1).max(180).optional().default(30),
	teamId: z.string().optional(),
});

const getTeamStandupDaySchema = orgIdSchema.extend({
	date: dateInputSchema.optional(),
	teamId: z.string(),
});

const getTeamStandupHistorySchema = orgIdSchema.extend({
	teamId: z.string(),
	limit: z.number().int().min(1).max(180).optional().default(30),
});

type ToolContext = {
	request: Request;
	actor: Actor;
};

const tools = [
	{
		name: "list_organizations",
		description: "List organizations accessible by the API key user.",
		permission: "profile:read" as ApiPermission,
		inputSchema: {
			type: "object",
			properties: {},
		},
		handler: async ({ actor }: ToolContext) => {
			const memberships = await db.query.member.findMany({
				where: eq(member.userId, actor.id),
				columns: { role: true, organizationId: true },
				with: {
					organization: {
						columns: { id: true, name: true, slug: true },
					},
				},
			});

			return {
				user: {
					id: actor.id,
					name: actor.name,
					email: actor.email,
				},
				organizations: memberships.map((row) => ({
					id: row.organization.id,
					name: row.organization.name,
					slug: row.organization.slug,
					role: row.role,
				})),
			};
		},
	},
	{
		name: "list_teams",
		description: "List teams in an organization.",
		permission: "teams:read" as ApiPermission,
		inputSchema: {
			type: "object",
			properties: {
				orgId: { type: "string" },
			},
		},
		handler: async ({ actor }: ToolContext, rawArgs: unknown) => {
			const args = orgIdSchema.parse(rawArgs ?? {});
			const { organization } = await resolveOrganizationScope(
				actor.id,
				args.orgId,
			);

			const teams = await db.query.team.findMany({
				where: eq(team.organizationId, organization.id),
				columns: { id: true, name: true, createdAt: true },
				with: {
					teamMembers: {
						columns: { userId: true },
					},
				},
			});

			return {
				organization,
				teams: teams.map((row) => ({
					id: row.id,
					name: row.name,
					isMember: row.teamMembers.some(
						(teamMembership) => teamMembership.userId === actor.id,
					),
					memberCount: row.teamMembers.length,
					createdAt: row.createdAt,
				})),
			};
		},
	},
	{
		name: "list_my_teams",
		description: "List only the teams this API key user belongs to.",
		permission: "teams:read" as ApiPermission,
		inputSchema: {
			type: "object",
			properties: {
				orgId: { type: "string" },
			},
		},
		handler: async ({ actor }: ToolContext, rawArgs: unknown) => {
			const args = orgIdSchema.parse(rawArgs ?? {});
			const { organization } = await resolveOrganizationScope(
				actor.id,
				args.orgId,
			);

			const memberships = await db.query.teamMember.findMany({
				where: eq(teamMember.userId, actor.id),
				with: {
					team: {
						columns: {
							id: true,
							name: true,
							organizationId: true,
							createdAt: true,
						},
						with: {
							teamMembers: {
								columns: { userId: true },
							},
						},
					},
				},
				orderBy: [desc(teamMember.createdAt)],
			});

			const teams = memberships
				.map((membership) => membership.team)
				.filter(
					(membershipTeam) => membershipTeam.organizationId === organization.id,
				);

			return {
				organization,
				count: teams.length,
				teams: teams.map((membershipTeam) => ({
					id: membershipTeam.id,
					name: membershipTeam.name,
					isMember: true,
					memberCount: membershipTeam.teamMembers.length,
					createdAt: membershipTeam.createdAt,
				})),
			};
		},
	},
	{
		name: "list_org_members",
		description: "List organization members and roles.",
		permission: "teams:read" as ApiPermission,
		inputSchema: {
			type: "object",
			properties: {
				orgId: { type: "string" },
			},
		},
		handler: async ({ actor }: ToolContext, rawArgs: unknown) => {
			const args = orgIdSchema.parse(rawArgs ?? {});
			const { organization } = await resolveOrganizationScope(
				actor.id,
				args.orgId,
			);

			const members = await db.query.member.findMany({
				where: eq(member.organizationId, organization.id),
				columns: { role: true, organizationId: true },
				with: {
					user: {
						columns: { id: true, name: true, email: true, image: true },
					},
				},
			});

			return {
				organization,
				members: members.map((row) => ({
					id: row.user.id,
					name: row.user.name,
					email: row.user.email,
					image: row.user.image,
					role: row.role,
				})),
			};
		},
	},
	{
		name: "add_organization_member",
		description:
			"Owner only. Add an existing user by email to the organization as member/admin.",
		permission: "members:manage" as ApiPermission,
		inputSchema: {
			type: "object",
			properties: {
				orgId: { type: "string" },
				email: { type: "string" },
				role: { type: "string", enum: ["member", "admin"] },
			},
			required: ["email"],
		},
		handler: async ({ actor }: ToolContext, rawArgs: unknown) => {
			const args = addOrganizationMemberSchema.parse(rawArgs ?? {});
			const { organization } = await resolveOrganizationScope(
				actor.id,
				args.orgId,
			);
			await assertOwnerRole(actor.id, organization.id);

			const targetUser = await db.query.user.findFirst({
				where: eq(user.email, args.email),
				columns: { id: true, name: true, email: true, image: true },
			});
			if (!targetUser) {
				throw new McpError(
					404,
					"USER_NOT_FOUND",
					"No user exists with that email address.",
				);
			}

			const existingMembership = await db.query.member.findFirst({
				where: and(
					eq(member.organizationId, organization.id),
					eq(member.userId, targetUser.id),
				),
				columns: { id: true, role: true },
			});
			if (existingMembership) {
				return {
					organization,
					member: {
						id: targetUser.id,
						name: targetUser.name,
						email: targetUser.email,
						image: targetUser.image,
						role: existingMembership.role,
					},
					created: false,
					message: "User is already a member of this organization.",
				};
			}

			await assertOrganizationMemberLimit(organization.id, actor.id);

			await db.insert(member).values({
				id: randomId(),
				organizationId: organization.id,
				userId: targetUser.id,
				role: args.role,
				createdAt: new Date(),
			});

			return {
				organization,
				member: {
					id: targetUser.id,
					name: targetUser.name,
					email: targetUser.email,
					image: targetUser.image,
					role: args.role,
				},
				created: true,
			};
		},
	},
	{
		name: "assign_user_to_team",
		description: "Owner only. Assign an organization member to a team.",
		permission: "members:manage" as ApiPermission,
		inputSchema: {
			type: "object",
			properties: {
				orgId: { type: "string" },
				teamId: { type: "string" },
				userId: { type: "string" },
			},
			required: ["teamId", "userId"],
		},
		handler: async ({ actor }: ToolContext, rawArgs: unknown) => {
			const args = assignUserToTeamSchema.parse(rawArgs ?? {});
			const { organization } = await resolveOrganizationScope(
				actor.id,
				args.orgId,
			);
			await assertOwnerRole(actor.id, organization.id);

			const targetTeam = await assertTeamInOrganization(
				args.teamId,
				organization.id,
			);
			const targetMember = await assertUserInOrganization(
				args.userId,
				organization.id,
			);

			const existingAssignment = await db.query.teamMember.findFirst({
				where: and(
					eq(teamMember.teamId, targetTeam.id),
					eq(teamMember.userId, targetMember.user.id),
				),
				columns: { id: true },
			});

			if (existingAssignment) {
				return {
					organization,
					team: { id: targetTeam.id, name: targetTeam.name },
					user: targetMember.user,
					created: false,
					message: "User is already assigned to this team.",
				};
			}

			await assertTeamMemberLimit(organization.id, targetTeam.id, actor.id);

			await db.insert(teamMember).values({
				id: randomId(),
				teamId: targetTeam.id,
				userId: targetMember.user.id,
				createdAt: new Date(),
			});

			return {
				organization,
				team: { id: targetTeam.id, name: targetTeam.name },
				user: targetMember.user,
				created: true,
			};
		},
	},
	{
		name: "remove_user_from_team",
		description: "Owner only. Remove a user from a team.",
		permission: "members:manage" as ApiPermission,
		inputSchema: {
			type: "object",
			properties: {
				orgId: { type: "string" },
				teamId: { type: "string" },
				userId: { type: "string" },
			},
			required: ["teamId", "userId"],
		},
		handler: async ({ actor }: ToolContext, rawArgs: unknown) => {
			const args = assignUserToTeamSchema.parse(rawArgs ?? {});
			const { organization } = await resolveOrganizationScope(
				actor.id,
				args.orgId,
			);
			await assertOwnerRole(actor.id, organization.id);

			const targetTeam = await assertTeamInOrganization(
				args.teamId,
				organization.id,
			);
			await assertUserInOrganization(args.userId, organization.id);

			const existingAssignment = await db.query.teamMember.findFirst({
				where: and(
					eq(teamMember.teamId, targetTeam.id),
					eq(teamMember.userId, args.userId),
				),
				columns: { id: true },
			});

			if (!existingAssignment) {
				return {
					organization,
					team: { id: targetTeam.id, name: targetTeam.name },
					userId: args.userId,
					deleted: false,
					message: "User is not assigned to this team.",
				};
			}

			await db
				.delete(teamMember)
				.where(
					and(
						eq(teamMember.teamId, targetTeam.id),
						eq(teamMember.userId, args.userId),
					),
				);

			return {
				organization,
				team: { id: targetTeam.id, name: targetTeam.name },
				userId: args.userId,
				deleted: true,
			};
		},
	},
	{
		name: "submit_my_standup",
		description:
			"Submit or replace your standup for a date and optional team scope.",
		permission: "standups:write" as ApiPermission,
		inputSchema: {
			type: "object",
			properties: {
				orgId: { type: "string" },
				date: { type: "string", description: "YYYY-MM-DD" },
				teamId: { type: ["string", "null"] },
				completed: { type: "array", items: { type: "string" } },
				planned: { type: "array", items: { type: "string" } },
				blockers: { type: "array", items: { type: "string" } },
			},
		},
		handler: async ({ actor }: ToolContext, rawArgs: unknown) => {
			const args = standupSubmitSchema.parse(rawArgs ?? {});
			const { organization } = await resolveOrganizationScope(
				actor.id,
				args.orgId,
			);

			const date = assertDate(args.date ?? isoDate(new Date()));
			const targetTeamId = args.teamId ?? null;

			if (targetTeamId) {
				await assertTeamInOrganization(targetTeamId, organization.id);
				await assertActorInTeam(actor.id, targetTeamId, "write");
			}

			const entries = [
				...args.completed.map((content) => ({
					type: "completed" as const,
					content: content.trim(),
				})),
				...args.planned.map((content) => ({
					type: "planned" as const,
					content: content.trim(),
				})),
				...args.blockers.map((content) => ({
					type: "blocker" as const,
					content: content.trim(),
				})),
			].filter((entry) => entry.content.length > 0);

			await db
				.delete(standupEntry)
				.where(
					and(
						eq(standupEntry.userId, actor.id),
						eq(standupEntry.organizationId, organization.id),
						eq(standupEntry.date, date),
						targetTeamId
							? eq(standupEntry.teamId, targetTeamId)
							: isNull(standupEntry.teamId),
					),
				);

			if (entries.length > 0) {
				await db.insert(standupEntry).values(
					entries.map((entry) => ({
						userId: actor.id,
						organizationId: organization.id,
						teamId: targetTeamId,
						date,
						type: entry.type,
						content: entry.content,
					})),
				);
			}

			return {
				organization,
				date,
				teamId: targetTeamId,
				writtenEntries: entries.length,
				breakdown: {
					completed: entries.filter((entry) => entry.type === "completed")
						.length,
					planned: entries.filter((entry) => entry.type === "planned").length,
					blockers: entries.filter((entry) => entry.type === "blocker").length,
				},
			};
		},
	},
	{
		name: "get_my_standup",
		description:
			"Get your standup for a specific day. If teamId is passed, team-specific entries are preferred with global fallback.",
		permission: "standups:read" as ApiPermission,
		inputSchema: {
			type: "object",
			properties: {
				orgId: { type: "string" },
				date: { type: "string", description: "YYYY-MM-DD" },
				teamId: { type: "string" },
			},
		},
		handler: async ({ actor }: ToolContext, rawArgs: unknown) => {
			const args = getStandupSchema.parse(rawArgs ?? {});
			const { organization } = await resolveOrganizationScope(
				actor.id,
				args.orgId,
			);
			const date = assertDate(args.date ?? isoDate(new Date()));
			const teamId = args.teamId;
			const { floorDate } = await resolveHistoryConstraints(
				organization.id,
				actor.id,
			);

			if (teamId) {
				await assertTeamInOrganization(teamId, organization.id);
				await assertActorInTeam(actor.id, teamId, "read");
			}

			if (floorDate && date < floorDate) {
				if (teamId) {
					return {
						organization,
						date,
						teamId,
						entryCount: 0,
						completed: [],
						planned: [],
						blockers: [],
					};
				}
				return {
					organization,
					date,
					scopes: [],
				};
			}

			const entries = await db.query.standupEntry.findMany({
				where: and(
					eq(standupEntry.userId, actor.id),
					eq(standupEntry.organizationId, organization.id),
					eq(standupEntry.date, date),
				),
				with: {
					team: {
						columns: { id: true, name: true },
					},
				},
				orderBy: [desc(standupEntry.createdAt)],
			});

			if (teamId) {
				const selectedEntries = chooseEntriesForTeam(entries, teamId);
				return {
					organization,
					date,
					teamId,
					entryCount: selectedEntries.length,
					...groupEntriesByType(selectedEntries),
				};
			}

			const byScope = new Map<string, typeof entries>();
			for (const entry of entries) {
				const key = entry.teamId ?? "__GLOBAL__";
				if (!byScope.has(key)) byScope.set(key, []);
				const scopedEntries = byScope.get(key);
				if (scopedEntries) {
					scopedEntries.push(entry);
				}
			}

			return {
				organization,
				date,
				scopes: Array.from(byScope.values()).flatMap((scopeEntries) => {
					const firstEntry = scopeEntries[0];
					if (!firstEntry) {
						return [];
					}
					return {
						teamId: firstEntry.teamId,
						teamName: firstEntry.team?.name ?? "GENERAL",
						entryCount: scopeEntries.length,
						...groupEntriesByType(scopeEntries),
					};
				}),
			};
		},
	},
	{
		name: "get_my_standup_history",
		description:
			"Get your standup history for an organization. Optional teamId applies team preference with fallback.",
		permission: "standups:read" as ApiPermission,
		inputSchema: {
			type: "object",
			properties: {
				orgId: { type: "string" },
				teamId: { type: "string" },
				limit: { type: "number", minimum: 1, maximum: 180 },
			},
		},
		handler: async ({ actor }: ToolContext, rawArgs: unknown) => {
			const args = getStandupHistorySchema.parse(rawArgs ?? {});
			const { organization } = await resolveOrganizationScope(
				actor.id,
				args.orgId,
			);
			const teamId = args.teamId;
			const { floorDate, maxDays } = await resolveHistoryConstraints(
				organization.id,
				actor.id,
			);
			const effectiveLimit = Math.min(args.limit, maxDays);
			if (teamId) {
				await assertTeamInOrganization(teamId, organization.id);
				await assertActorInTeam(actor.id, teamId, "read");
			}

			const conditions = [
				eq(standupEntry.userId, actor.id),
				eq(standupEntry.organizationId, organization.id),
			];
			if (floorDate) {
				conditions.push(gte(standupEntry.date, floorDate));
			}
			if (teamId) {
				const scopeCondition = or(
					eq(standupEntry.teamId, teamId),
					isNull(standupEntry.teamId),
				);
				if (scopeCondition) conditions.push(scopeCondition);
			}

			const entries = await db.query.standupEntry.findMany({
				where: and(...conditions),
				with: {
					team: {
						columns: { id: true, name: true },
					},
				},
				orderBy: [desc(standupEntry.date), desc(standupEntry.createdAt)],
				limit: 4000,
			});

			const byDate = new Map<string, typeof entries>();
			for (const entry of entries) {
				if (!byDate.has(entry.date)) byDate.set(entry.date, []);
				const dateEntries = byDate.get(entry.date);
				if (dateEntries) {
					dateEntries.push(entry);
				}
			}

			const dates = Array.from(byDate.keys()).sort((a, b) =>
				b.localeCompare(a),
			);
			const history = dates.slice(0, effectiveLimit).map((date) => {
				const dateEntries = byDate.get(date) ?? [];
				if (teamId) {
					const selectedEntries = chooseEntriesForTeam(dateEntries, teamId);
					return {
						date,
						teamId,
						entryCount: selectedEntries.length,
						...groupEntriesByType(selectedEntries),
					};
				}

				const byScope = new Map<string, typeof entries>();
				for (const entry of dateEntries) {
					const key = entry.teamId ?? "__GLOBAL__";
					if (!byScope.has(key)) byScope.set(key, []);
					const scopedEntries = byScope.get(key);
					if (scopedEntries) {
						scopedEntries.push(entry);
					}
				}

				return {
					date,
					scopes: Array.from(byScope.values()).flatMap((scopeEntries) => {
						const firstEntry = scopeEntries[0];
						if (!firstEntry) {
							return [];
						}
						return {
							teamId: firstEntry.teamId,
							teamName: firstEntry.team?.name ?? "GENERAL",
							entryCount: scopeEntries.length,
							...groupEntriesByType(scopeEntries),
						};
					}),
				};
			});

			return {
				organization,
				limit: effectiveLimit,
				teamId: teamId ?? null,
				days: history.length,
				history,
			};
		},
	},
	{
		name: "get_team_standup_day",
		description:
			"Get all standups for a team on a specific day. Requires membership in that team.",
		permission: "standups:read" as ApiPermission,
		inputSchema: {
			type: "object",
			properties: {
				orgId: { type: "string" },
				teamId: { type: "string" },
				date: { type: "string", description: "YYYY-MM-DD" },
			},
			required: ["teamId"],
		},
		handler: async ({ actor }: ToolContext, rawArgs: unknown) => {
			const args = getTeamStandupDaySchema.parse(rawArgs ?? {});
			const { organization } = await resolveOrganizationScope(
				actor.id,
				args.orgId,
			);
			const targetTeam = await assertTeamInOrganization(
				args.teamId,
				organization.id,
			);
			await assertActorInTeam(actor.id, targetTeam.id, "read");
			const date = assertDate(args.date ?? isoDate(new Date()));
			const { floorDate } = await resolveHistoryConstraints(
				organization.id,
				actor.id,
			);

			if (floorDate && date < floorDate) {
				return {
					organization,
					team: { id: targetTeam.id, name: targetTeam.name },
					date,
					count: 0,
					standups: [],
				};
			}

			const entries = await db.query.standupEntry.findMany({
				where: and(
					eq(standupEntry.organizationId, organization.id),
					eq(standupEntry.date, date),
					or(
						eq(standupEntry.teamId, targetTeam.id),
						isNull(standupEntry.teamId),
					),
				),
				with: {
					user: {
						columns: { id: true, name: true, image: true },
					},
				},
				orderBy: [desc(standupEntry.createdAt)],
			});

			const byUser = new Map<string, typeof entries>();
			for (const entry of entries) {
				if (!byUser.has(entry.userId)) byUser.set(entry.userId, []);
				const userEntries = byUser.get(entry.userId);
				if (userEntries) {
					userEntries.push(entry);
				}
			}

			const standups = Array.from(byUser.values()).map((userEntries) => {
				const selectedEntries = chooseEntriesForTeam(
					userEntries,
					targetTeam.id,
				);
				const fallbackEntry = userEntries[0];
				if (!fallbackEntry) {
					throw new McpError(
						500,
						"INTERNAL_ERROR",
						"Unexpected empty standup bucket.",
					);
				}
				return {
					user: selectedEntries[0]?.user ?? fallbackEntry.user,
					entryCount: selectedEntries.length,
					...groupEntriesByType(selectedEntries),
				};
			});

			return {
				organization,
				team: { id: targetTeam.id, name: targetTeam.name },
				date,
				count: standups.length,
				standups,
			};
		},
	},
	{
		name: "get_team_standup_history",
		description:
			"Get recent standup history for a team. Requires membership in that team.",
		permission: "standups:read" as ApiPermission,
		inputSchema: {
			type: "object",
			properties: {
				orgId: { type: "string" },
				teamId: { type: "string" },
				limit: { type: "number", minimum: 1, maximum: 180 },
			},
			required: ["teamId"],
		},
		handler: async ({ actor }: ToolContext, rawArgs: unknown) => {
			const args = getTeamStandupHistorySchema.parse(rawArgs ?? {});
			const { organization } = await resolveOrganizationScope(
				actor.id,
				args.orgId,
			);
			const targetTeam = await assertTeamInOrganization(
				args.teamId,
				organization.id,
			);
			await assertActorInTeam(actor.id, targetTeam.id, "read");
			const { floorDate, maxDays } = await resolveHistoryConstraints(
				organization.id,
				actor.id,
			);
			const effectiveLimit = Math.min(args.limit, maxDays);

			const conditions = [
				eq(standupEntry.organizationId, organization.id),
				or(eq(standupEntry.teamId, targetTeam.id), isNull(standupEntry.teamId)),
			];
			if (floorDate) {
				conditions.push(gte(standupEntry.date, floorDate));
			}

			const entries = await db.query.standupEntry.findMany({
				where: and(...conditions),
				with: {
					user: {
						columns: { id: true, name: true, image: true },
					},
				},
				orderBy: [desc(standupEntry.date), desc(standupEntry.createdAt)],
				limit: 6000,
			});

			const byDate = new Map<string, typeof entries>();
			for (const entry of entries) {
				if (!byDate.has(entry.date)) byDate.set(entry.date, []);
				const dateEntries = byDate.get(entry.date);
				if (dateEntries) {
					dateEntries.push(entry);
				}
			}

			const dates = Array.from(byDate.keys()).sort((a, b) =>
				b.localeCompare(a),
			);
			const history = dates.slice(0, effectiveLimit).map((date) => {
				const dateEntries = byDate.get(date) ?? [];
				const byUser = new Map<string, typeof entries>();
				for (const entry of dateEntries) {
					if (!byUser.has(entry.userId)) byUser.set(entry.userId, []);
					const userEntries = byUser.get(entry.userId);
					if (userEntries) {
						userEntries.push(entry);
					}
				}

				const standups = Array.from(byUser.values()).map((userEntries) => {
					const selectedEntries = chooseEntriesForTeam(
						userEntries,
						targetTeam.id,
					);
					const fallbackEntry = userEntries[0];
					if (!fallbackEntry) {
						throw new McpError(
							500,
							"INTERNAL_ERROR",
							"Unexpected empty standup bucket.",
						);
					}
					return {
						user: selectedEntries[0]?.user ?? fallbackEntry.user,
						entryCount: selectedEntries.length,
						...groupEntriesByType(selectedEntries),
					};
				});

				return {
					date,
					count: standups.length,
					standups,
				};
			});

			return {
				organization,
				team: { id: targetTeam.id, name: targetTeam.name },
				limit: effectiveLimit,
				days: history.length,
				history,
			};
		},
	},
] as const;

type ToolName = (typeof tools)[number]["name"];

function getToolsForMcp() {
	return tools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		inputSchema: tool.inputSchema,
	}));
}

async function handleToolsCall(
	request: Request,
	name: ToolName,
	rawArguments: unknown,
): Promise<ToolResult> {
	const tool = tools.find((candidate) => candidate.name === name);
	if (!tool) {
		throw new McpError(404, "TOOL_NOT_FOUND", `Unknown tool: ${name}`);
	}

	const actor = await requireActor(request, tool.permission);
	return toolResult(
		await tool.handler(
			{
				request,
				actor,
			},
			rawArguments,
		),
	);
}

async function handleRpcRequest(request: Request): Promise<Response> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return jsonResponse(
			rpcError(null, -32700, "Parse error: request body must be valid JSON."),
			400,
		);
	}

	if (Array.isArray(body)) {
		return jsonResponse(
			rpcError(null, -32600, "Batch requests are not supported."),
			400,
		);
	}

	const parsed = jsonRpcRequestSchema.safeParse(body);
	if (!parsed.success) {
		return jsonResponse(
			rpcError(null, -32600, "Invalid JSON-RPC request."),
			400,
		);
	}

	const { id = null, method, params } = parsed.data;
	const isNotification = parsed.data.id === undefined;

	try {
		if (method === "initialize") {
			const result = {
				protocolVersion: "2024-11-05",
				capabilities: {
					tools: {},
				},
				serverInfo: {
					name: "dailystand-mcp",
					version: "1.0.0",
				},
			};
			return jsonResponse(rpcSuccess(id, result));
		}

		if (method === "notifications/initialized") {
			return isNotification
				? noContentResponse()
				: jsonResponse(rpcSuccess(id, null));
		}

		if (method === "tools/list") {
			await requireActor(request, "profile:read");
			return jsonResponse(rpcSuccess(id, { tools: getToolsForMcp() }));
		}

		if (method === "tools/call") {
			const parsedParams = toolsCallParamsSchema.safeParse(params ?? {});
			if (!parsedParams.success) {
				return jsonResponse(
					rpcError(id, -32602, "Invalid params for tools/call."),
					400,
				);
			}

			const toolName = parsedParams.data.name as ToolName;
			const result = await handleToolsCall(
				request,
				toolName,
				parsedParams.data.arguments ?? {},
			).catch((error) => toolErrorResult(error));

			return jsonResponse(rpcSuccess(id, result));
		}

		return jsonResponse(
			rpcError(id, -32601, `Method not found: ${method}`),
			404,
		);
	} catch (error) {
		const message =
			error instanceof McpError ? error.message : "Internal server error.";
		return jsonResponse(rpcError(id, -32000, message), 500);
	}
}

function handleGet(request: Request): Response {
	const baseUrl = new URL(request.url).origin;
	return jsonResponse({
		name: "dailystand-mcp",
		version: "1.0.0",
		endpoint: `${baseUrl}/api/mcp`,
		transport: "JSON-RPC 2.0 over HTTP POST",
		authentication: {
			header: "x-api-key",
			bearerSupported: true,
		},
		notes: [
			"Call initialize first, then tools/list and tools/call.",
			"Owner-only tools: add_organization_member, assign_user_to_team, remove_user_from_team.",
			"Member tools: list_my_teams, submit_my_standup, get_my_standup, get_my_standup_history, get_team_standup_day, get_team_standup_history.",
		],
	});
}

function withCors(request: Request, response: Response): Response {
	const headers = new Headers(response.headers);
	const origin = request.headers.get("origin");
	for (const [key, value] of Object.entries(buildCorsHeaders(origin))) {
		headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		headers,
	});
}

function optionsResponse(request: Request): Response {
	const origin = request.headers.get("origin");
	if (!isCorsOriginAllowed(origin)) {
		return new Response(null, { status: 403 });
	}
	return new Response(null, {
		status: 204,
		headers: buildCorsHeaders(origin),
	});
}

export const Route = createFileRoute("/api/mcp")({
	server: {
		handlers: {
			GET: ({ request }) => withCors(request, handleGet(request)),
			POST: ({ request }) =>
				handleRpcRequest(request).then((response) =>
					withCors(request, response),
				),
			OPTIONS: ({ request }) => optionsResponse(request),
		},
	},
});
