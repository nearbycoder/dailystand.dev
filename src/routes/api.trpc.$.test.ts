import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type FetchRequestHandlerArgs = {
	req: Request;
	router: unknown;
	endpoint: string;
	createContext: () => Promise<unknown>;
};

const { capturedConfig, fetchRequestHandlerMock, getSessionMock, trpcRouterMock } =
	vi.hoisted(() => ({
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
		fetchRequestHandlerMock: vi.fn(),
		getSessionMock: vi.fn(),
		trpcRouterMock: { _tag: "trpc-router-mock" },
	}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (config: unknown) => {
		capturedConfig.value = config as typeof capturedConfig.value;
		return {};
	},
}));

vi.mock("@trpc/server/adapters/fetch", () => ({
	fetchRequestHandler: fetchRequestHandlerMock,
}));

vi.mock("@/integrations/trpc/router", () => ({
	trpcRouter: trpcRouterMock,
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: getSessionMock,
		},
	},
}));

function handlers() {
	const routeConfig = capturedConfig.value;
	if (!routeConfig) throw new Error("Route config was not captured");
	return routeConfig.server.handlers;
}

describe("trpc api route handler", () => {
	beforeAll(async () => {
		await import("./api.trpc.$");
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses fetchRequestHandler for GET and builds auth-aware context", async () => {
		const request = new Request("https://dailystand.dev/api/trpc/teams.list", {
			method: "GET",
			headers: {
				authorization: "Bearer token_123",
			},
		});
		const session = { user: { id: "user_1" } };
		const response = new Response("ok", { status: 200 });
		getSessionMock.mockResolvedValueOnce(session);
		fetchRequestHandlerMock.mockResolvedValueOnce(response);

		const routeResponse = await handlers().GET({ request });

		expect(routeResponse).toBe(response);
		expect(fetchRequestHandlerMock).toHaveBeenCalledTimes(1);
		const args = fetchRequestHandlerMock.mock.calls[0]?.[0] as
			| FetchRequestHandlerArgs
			| undefined;
		if (!args) throw new Error("Expected fetchRequestHandler args");
		expect(args.req).toBe(request);
		expect(args.router).toBe(trpcRouterMock);
		expect(args.endpoint).toBe("/api/trpc");
		await expect(args.createContext()).resolves.toEqual({ session });
		expect(getSessionMock).toHaveBeenCalledWith({
			headers: request.headers,
		});
	});

	it("uses the same adapter pipeline for POST requests", async () => {
		const request = new Request("https://dailystand.dev/api/trpc/standups.upsert", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({}),
		});
		const response = new Response("created", { status: 201 });
		getSessionMock.mockResolvedValueOnce(null);
		fetchRequestHandlerMock.mockResolvedValueOnce(response);

		const routeResponse = await handlers().POST({ request });

		expect(routeResponse).toBe(response);
		expect(fetchRequestHandlerMock).toHaveBeenCalledTimes(1);
		const args = fetchRequestHandlerMock.mock.calls[0]?.[0] as
			| FetchRequestHandlerArgs
			| undefined;
		if (!args) throw new Error("Expected fetchRequestHandler args");
		await expect(args.createContext()).resolves.toEqual({ session: null });
	});
});
