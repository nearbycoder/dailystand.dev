import { describe, expect, it } from "vitest";
import { shouldRetryQuery } from "./root-provider";

describe("shouldRetryQuery", () => {
	it("never retries deterministic 4xx tRPC errors", () => {
		for (const code of [
			"BAD_REQUEST",
			"UNAUTHORIZED",
			"FORBIDDEN",
			"NOT_FOUND",
			"PRECONDITION_FAILED",
		]) {
			expect(shouldRetryQuery(0, { data: { code } })).toBe(false);
		}
		expect(shouldRetryQuery(0, { data: { httpStatus: 403 } })).toBe(false);
	});

	it("retries transient or 5xx errors at most once to avoid prolonged loading spinners", () => {
		expect(
			shouldRetryQuery(0, {
				data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
			}),
		).toBe(true);
		expect(
			shouldRetryQuery(1, {
				data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
			}),
		).toBe(false);
		expect(shouldRetryQuery(0, { data: { httpStatus: 429 } })).toBe(true);
		expect(shouldRetryQuery(0, new Error("Network failure"))).toBe(true);
		expect(shouldRetryQuery(1, new Error("Network failure"))).toBe(false);
	});
});
