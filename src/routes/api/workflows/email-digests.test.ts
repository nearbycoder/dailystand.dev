import { beforeEach, describe, expect, it, vi } from "vitest";

const { runDigestWorkflowMock, capturedConfig } = vi.hoisted(() => ({
	runDigestWorkflowMock: vi.fn(),
	capturedConfig: {
		value: null as null | {
			server: {
				handlers: {
					GET: (ctx: { request: Request }) => Response;
					POST: (ctx: { request: Request }) => Promise<Response>;
				};
			};
		},
	},
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (config: unknown) => {
		capturedConfig.value = config as typeof capturedConfig.value;
		return {};
	},
}));

vi.mock("@/lib/email-digests", () => ({
	runDigestWorkflow: runDigestWorkflowMock,
}));

import "./email-digests";

function handlers() {
	const routeConfig = capturedConfig.value;
	if (!routeConfig) {
		throw new Error("Route config was not captured");
	}
	return routeConfig.server.handlers;
}

describe("workflow email-digests route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.EMAIL_DIGEST_WORKFLOW_SECRET = "secret_123";
		delete process.env.WORKFLOW_SECRET;
	});

	it("rejects unauthorized GET requests", async () => {
		const response = handlers().GET({
			request: new Request("https://dailystand.dev/api/workflows/email-digests"),
		});
		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
		});
	});

	it("accepts authorized GET requests and returns endpoint metadata", async () => {
		const response = handlers().GET({
			request: new Request("https://dailystand.dev/api/workflows/email-digests", {
				headers: {
					"x-workflow-secret": "secret_123",
				},
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			data: {
				endpoint: "/api/workflows/email-digests",
				method: "POST",
			},
		});
	});

	it("returns bad request for invalid cadence payloads", async () => {
		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/workflows/email-digests", {
				method: "POST",
				headers: {
					"x-workflow-secret": "secret_123",
					"content-type": "application/json",
				},
				body: JSON.stringify({ cadence: "hourly" }),
			}),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
		});
		expect(runDigestWorkflowMock).not.toHaveBeenCalled();
	});

	it("runs selected cadence when explicitly requested", async () => {
		runDigestWorkflowMock.mockResolvedValue({
			cadence: "daily",
			attempted: 1,
			sent: 1,
			skipped: 0,
			errors: [],
		});

		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/workflows/email-digests", {
				method: "POST",
				headers: {
					"x-workflow-secret": "secret_123",
					"content-type": "application/json",
				},
				body: JSON.stringify({ cadence: "daily" }),
			}),
		});

		expect(response.status).toBe(200);
		expect(runDigestWorkflowMock).toHaveBeenCalledTimes(1);
		expect(runDigestWorkflowMock).toHaveBeenCalledWith("daily");
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			data: {
				cadence: "daily",
			},
		});
	});

	it("runs both cadences by default and reports server errors", async () => {
		runDigestWorkflowMock
			.mockResolvedValueOnce({
				cadence: "daily",
				attempted: 1,
				sent: 1,
				skipped: 0,
				errors: [],
			})
			.mockRejectedValueOnce(new Error("weekly failed"));

		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/workflows/email-digests", {
				method: "POST",
				headers: {
					"x-workflow-secret": "secret_123",
				},
			}),
		});

		expect(runDigestWorkflowMock).toHaveBeenCalledTimes(2);
		expect(runDigestWorkflowMock).toHaveBeenNthCalledWith(1, "daily");
		expect(runDigestWorkflowMock).toHaveBeenNthCalledWith(2, "weekly");
		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error: "Workflow execution failed.",
		});
	});
});
