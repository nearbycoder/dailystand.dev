import { wrapFetchWithSentry } from "@sentry/tanstackstart-react";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

const NO_STORE_API_PREFIXES = [
	"/api/auth",
	"/api/trpc",
	"/api/settings",
	"/api/public",
	"/api/mcp",
	"/api/workflows",
];

const NO_REFERRER_PATH_PREFIXES = ["/share/", "/auth/reset-password"];

export function applySecurityHeaders(
	request: Request,
	response: Response,
): Response {
	const headers = new Headers(response.headers);
	const url = new URL(request.url);
	const pathname = url.pathname;

	if (!headers.has("X-Content-Type-Options")) {
		headers.set("X-Content-Type-Options", "nosniff");
	}
	if (!headers.has("X-Frame-Options")) {
		headers.set("X-Frame-Options", "DENY");
	}
	if (!headers.has("Permissions-Policy")) {
		headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
	}
	if (!headers.has("Referrer-Policy")) {
		const isSensitivePath = NO_REFERRER_PATH_PREFIXES.some((prefix) =>
			pathname.startsWith(prefix),
		);
		headers.set(
			"Referrer-Policy",
			isSensitivePath ? "no-referrer" : "strict-origin-when-cross-origin",
		);
	}

	const forwardedProto = request.headers
		.get("x-forwarded-proto")
		?.split(",")[0]
		?.trim()
		.toLowerCase();
	const isHttps = url.protocol === "https:" || forwardedProto === "https";
	if (isHttps && !headers.has("Strict-Transport-Security")) {
		headers.set(
			"Strict-Transport-Security",
			"max-age=31536000; includeSubDomains",
		);
	}

	const isSensitiveApiPath = NO_STORE_API_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
	if (isSensitiveApiPath && !headers.has("Cache-Control")) {
		headers.set("Cache-Control", "no-store");
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export default createServerEntry(
	wrapFetchWithSentry({
		async fetch(request: Request) {
			const response = await handler.fetch(request);
			return applySecurityHeaders(request, response);
		},
	}),
);
