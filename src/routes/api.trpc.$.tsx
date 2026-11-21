import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { trpcRouter } from "@/integrations/trpc/router";
import { auth } from "@/lib/auth";

function parseCsvEnv(value?: string): string[] {
	return (value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function getTrustedOrigins(request: Request): Set<string> {
	const origins = new Set<string>([
		new URL(request.url).origin,
		...parseCsvEnv(process.env.BETTER_AUTH_URL),
		...parseCsvEnv(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
	]);

	const forwardedHost = request.headers
		.get("x-forwarded-host")
		?.split(",")[0]
		?.trim();
	const forwardedProto = request.headers
		.get("x-forwarded-proto")
		?.split(",")[0]
		?.trim();
	if (forwardedHost && (forwardedProto === "http" || forwardedProto === "https")) {
		origins.add(`${forwardedProto}://${forwardedHost}`);
	}

	return origins;
}

function isTrustedTrpcOrigin(request: Request): boolean {
	const originHeader = request.headers.get("origin");
	if (!originHeader) return true;
	return getTrustedOrigins(request).has(originHeader);
}

function handler({ request }: { request: Request }) {
	if (request.method === "POST" && !isTrustedTrpcOrigin(request)) {
		return new Response(
			JSON.stringify({
				error: {
					message: "Untrusted origin.",
				},
			}),
			{
				status: 403,
				headers: {
					"content-type": "application/json; charset=utf-8",
				},
			},
		);
	}

	return fetchRequestHandler({
		req: request,
		router: trpcRouter,
		endpoint: "/api/trpc",
		createContext: async () => {
			const session = await auth.api.getSession({
				headers: request.headers,
			});
			return { session };
		},
	});
}

export const Route = createFileRoute("/api/trpc/$")({
	server: {
		handlers: {
			GET: handler,
			POST: handler,
		},
	},
});
