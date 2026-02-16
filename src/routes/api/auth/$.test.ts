import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { capturedConfig, authHandlerMock } = vi.hoisted(() => ({
	capturedConfig: {
		value: null as null | {
			server: {
				handlers: {
					GET: (ctx: { request: Request }) => Promise<Response> | Response;
					POST: (ctx: { request: Request }) => Promise<Response> | Response;
				};
			};
		},
	},
	authHandlerMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (config: unknown) => {
		capturedConfig.value = config as typeof capturedConfig.value;
		return {};
	},
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		handler: authHandlerMock,
	},
}));

function handlers() {
	const routeConfig = capturedConfig.value;
	if (!routeConfig) throw new Error("Route config was not captured");
	return routeConfig.server.handlers;
}

describe("auth api route passthrough", () => {
	beforeAll(async () => {
		await import("./$");
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("forwards GET requests to auth.handler", async () => {
		const expectedResponse = new Response("ok", { status: 200 });
		authHandlerMock.mockResolvedValueOnce(expectedResponse);

		const request = new Request("https://dailystand.dev/api/auth/session", {
			method: "GET",
		});
		const response = await handlers().GET({ request });

		expect(response).toBe(expectedResponse);
		expect(authHandlerMock).toHaveBeenCalledTimes(1);
		expect(authHandlerMock).toHaveBeenCalledWith(request);
	});

	it("forwards POST requests to auth.handler", async () => {
		const expectedResponse = new Response("created", { status: 201 });
		authHandlerMock.mockResolvedValueOnce(expectedResponse);

		const request = new Request("https://dailystand.dev/api/auth/sign-in", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "dev@example.com" }),
		});
		const response = await handlers().POST({ request });

		expect(response).toBe(expectedResponse);
		expect(authHandlerMock).toHaveBeenCalledTimes(1);
		expect(authHandlerMock).toHaveBeenCalledWith(request);
	});
});
