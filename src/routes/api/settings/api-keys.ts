import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { member } from "@/db/schema";
import { auth } from "@/lib/auth";

const API_SCOPE_BASE = [
	"profile:read",
	"teams:read",
	"standups:read",
	"standups:write",
	"analytics:read",
] as const;
const API_SCOPE_MEMBER_MANAGE = "members:manage";

const createApiKeyBodySchema = z.object({
	name: z.string().trim().min(1).max(64),
	expiresInSeconds: z.number().int().positive().nullable(),
	includeMemberManage: z.boolean(),
});

function parseCsvEnv(value?: string): string[] {
	return (value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function getTrustedOriginsForRequest(request: Request): Set<string> {
	return new Set([
		new URL(request.url).origin,
		...parseCsvEnv(process.env.BETTER_AUTH_URL),
		...parseCsvEnv(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
	]);
}

function resolveOriginFromReferer(referer: string | null): string | null {
	if (!referer) return null;
	try {
		return new URL(referer).origin;
	} catch {
		return null;
	}
}

function isTrustedBrowserOrigin(request: Request): boolean {
	const trustedOrigins = getTrustedOriginsForRequest(request);
	const originHeader = request.headers.get("origin");
	if (originHeader) {
		return trustedOrigins.has(originHeader);
	}
	const refererOrigin = resolveOriginFromReferer(
		request.headers.get("referer"),
	);
	if (refererOrigin) {
		return trustedOrigins.has(refererOrigin);
	}
	return false;
}

function contentTypeIsJson(request: Request): boolean {
	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
	return contentType.includes("application/json");
}

function hasOwnerRole(roleValue: string): boolean {
	return roleValue
		.split(",")
		.map((role) => role.trim().toLowerCase())
		.some((role) => role === "owner");
}

function json(
	status: number,
	payload: {
		success: boolean;
		data?: unknown;
		error?: string;
	},
): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}
	if (typeof error === "string" && error.trim().length > 0) {
		return error;
	}
	return "Failed to create API key.";
}

async function assertCanGrantMemberManageScope(
	userId: string,
	activeOrganizationId: string | null | undefined,
) {
	if (!activeOrganizationId) {
		throw new Error(
			"Select an active organization before adding member-management scope.",
		);
	}
	const membership = await db.query.member.findFirst({
		where: and(
			eq(member.userId, userId),
			eq(member.organizationId, activeOrganizationId),
		),
		columns: { role: true },
	});
	if (!membership || !hasOwnerRole(membership.role)) {
		throw new Error(
			"Only organization owners can create API keys with member-management scope.",
		);
	}
}

export const Route = createFileRoute("/api/settings/api-keys")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!isTrustedBrowserOrigin(request)) {
					return json(403, {
						success: false,
						error: "Untrusted origin.",
					});
				}
				if (!contentTypeIsJson(request)) {
					return json(415, {
						success: false,
						error: "Content-Type must be application/json.",
					});
				}

				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session?.user?.id) {
					return json(401, {
						success: false,
						error: "You must be signed in to create API keys.",
					});
				}

				let body: unknown;
				try {
					body = await request.json();
				} catch {
					return json(400, {
						success: false,
						error: "Invalid JSON body.",
					});
				}

				const parsed = createApiKeyBodySchema.safeParse(body);
				if (!parsed.success) {
					return json(400, {
						success: false,
						error: "Invalid API key create payload.",
					});
				}

				if (parsed.data.includeMemberManage) {
					try {
						await assertCanGrantMemberManageScope(
							session.user.id,
							session.session.activeOrganizationId,
						);
					} catch (error) {
						return json(403, {
							success: false,
							error: getErrorMessage(error),
						});
					}
				}

				const permissions = {
					dailystand: parsed.data.includeMemberManage
						? [...API_SCOPE_BASE, API_SCOPE_MEMBER_MANAGE]
						: [...API_SCOPE_BASE],
				};

				try {
					const created = await auth.api.createApiKey({
						body: {
							userId: session.user.id,
							name: parsed.data.name,
							expiresIn: parsed.data.expiresInSeconds,
							metadata: {
								source: "settings.api-keys",
							},
							permissions,
						},
					});
					return json(200, {
						success: true,
						data: created,
					});
				} catch (error) {
					return json(400, {
						success: false,
						error: getErrorMessage(error),
					});
				}
			},
		},
	},
});
