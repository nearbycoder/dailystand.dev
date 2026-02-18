import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
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

export const Route = createFileRoute("/api/settings/api-keys")({
	server: {
		handlers: {
			POST: async ({ request }) => {
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
