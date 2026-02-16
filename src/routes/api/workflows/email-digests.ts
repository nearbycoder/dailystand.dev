import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runDigestWorkflow } from "@/lib/email-digests";

const bodySchema = z
	.object({
		cadence: z.enum(["daily", "weekly", "all"]).optional(),
	})
	.optional();

function resolveWorkflowSecret(): string | null {
	return (
		process.env.EMAIL_DIGEST_WORKFLOW_SECRET ??
		process.env.WORKFLOW_SECRET ??
		null
	);
}

function extractProvidedSecret(request: Request): string | null {
	const headerSecret = request.headers.get("x-workflow-secret")?.trim();
	if (headerSecret) return headerSecret;

	const authorization = request.headers.get("authorization")?.trim();
	if (authorization?.toLowerCase().startsWith("bearer ")) {
		const bearer = authorization.slice(7).trim();
		if (bearer) return bearer;
	}
	return null;
}

function secretsMatch(expected: string, provided: string | null): boolean {
	if (!provided) return false;
	const expectedBuffer = Buffer.from(expected);
	const providedBuffer = Buffer.from(provided);
	if (expectedBuffer.length !== providedBuffer.length) return false;
	return timingSafeEqual(expectedBuffer, providedBuffer);
}

function unauthorized(message = "Unauthorized workflow access."): Response {
	return new Response(JSON.stringify({ success: false, error: message }), {
		status: 401,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});
}

function badRequest(message: string): Response {
	return new Response(JSON.stringify({ success: false, error: message }), {
		status: 400,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});
}

function ok(payload: unknown): Response {
	return new Response(JSON.stringify({ success: true, data: payload }), {
		status: 200,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});
}

async function runSelectedCadence(cadence: "daily" | "weekly" | "all") {
	if (cadence === "daily") {
		const daily = await runDigestWorkflow("daily");
		return { cadence, daily };
	}
	if (cadence === "weekly") {
		const weekly = await runDigestWorkflow("weekly");
		return { cadence, weekly };
	}
	const [daily, weekly] = await Promise.all([
		runDigestWorkflow("daily"),
		runDigestWorkflow("weekly"),
	]);
	return { cadence, daily, weekly };
}

export const Route = createFileRoute("/api/workflows/email-digests")({
	server: {
		handlers: {
			GET: ({ request }) => {
				const secret = resolveWorkflowSecret();
				const provided = extractProvidedSecret(request);
				if (!secret || !secretsMatch(secret, provided)) return unauthorized();
				return ok({
					endpoint: "/api/workflows/email-digests",
					method: "POST",
					body: {
						cadence: "daily | weekly | all",
					},
				});
			},
			POST: async ({ request }) => {
				const secret = resolveWorkflowSecret();
				const provided = extractProvidedSecret(request);
				if (!secret || !secretsMatch(secret, provided)) return unauthorized();

				let cadence: "daily" | "weekly" | "all" = "all";
				if (request.headers.get("content-type")?.includes("application/json")) {
					const parsed = bodySchema.safeParse(await request.json());
					if (!parsed.success) {
						return badRequest(
							"Invalid body. cadence must be daily, weekly, or all.",
						);
					}
					cadence = parsed.data?.cadence ?? "all";
				}

				try {
					const result = await runSelectedCadence(cadence);
					return ok(result);
				} catch (error) {
					console.error("[WORKFLOW] Email digest execution failed", error);
					return new Response(
						JSON.stringify({
							success: false,
							error: "Workflow execution failed.",
						}),
						{
							status: 500,
							headers: {
								"content-type": "application/json; charset=utf-8",
							},
						},
					);
				}
			},
		},
	},
});
