import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/tanstackstart-react", () => ({
	wrapFetchWithSentry: <T,>(entry: T) => entry,
}));

vi.mock("@tanstack/react-start/server-entry", () => ({
	default: { fetch: vi.fn() },
	createServerEntry: <T,>(entry: T) => entry,
}));

import { applySecurityHeaders } from "./server";

describe("applySecurityHeaders", () => {
	it("applies standard security headers and HSTS on HTTPS requests", () => {
		const request = new Request("https://dailystand.dev/app");
		const response = applySecurityHeaders(
			request,
			new Response("ok", { status: 200 }),
		);

		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
		expect(response.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		expect(response.headers.get("Permissions-Policy")).toBe(
			"camera=(), microphone=(), geolocation=()",
		);
		expect(response.headers.get("Strict-Transport-Security")).toBe(
			"max-age=31536000; includeSubDomains",
		);
		expect(response.headers.get("Cache-Control")).toBeNull();
	});

	it("sets no-referrer on secret-token routes", () => {
		const shareResponse = applySecurityHeaders(
			new Request("https://dailystand.dev/share/secret_token_123456"),
			new Response("ok"),
		);
		expect(shareResponse.headers.get("Referrer-Policy")).toBe("no-referrer");

		const resetResponse = applySecurityHeaders(
			new Request("https://dailystand.dev/auth/reset-password?token=abc"),
			new Response("ok"),
		);
		expect(resetResponse.headers.get("Referrer-Policy")).toBe("no-referrer");
	});

	it("sets Cache-Control no-store on sensitive API routes without overriding OG cache headers", () => {
		const trpcResponse = applySecurityHeaders(
			new Request("http://localhost:3000/api/trpc/standups.getMine"),
			new Response("{}"),
		);
		expect(trpcResponse.headers.get("Cache-Control")).toBe("no-store");
		expect(trpcResponse.headers.get("Strict-Transport-Security")).toBeNull();

		const ogResponse = applySecurityHeaders(
			new Request("https://dailystand.dev/api/og?page=home"),
			new Response("png", {
				headers: { "Cache-Control": "public, max-age=3600" },
			}),
		);
		expect(ogResponse.headers.get("Cache-Control")).toBe("public, max-age=3600");
	});
});
