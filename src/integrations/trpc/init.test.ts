import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { createTRPCRouter, orgProcedure, protectedProcedure } from "./init";

const testRouter = createTRPCRouter({
	privatePing: protectedProcedure.query(() => "ok"),
	orgPing: orgProcedure.query(({ ctx }) => ctx.organizationId),
});

function authedSession(activeOrganizationId?: string | null) {
	return {
		user: {
			id: "user_1",
			email: "user@example.com",
			name: "User",
		},
		session: {
			activeOrganizationId: activeOrganizationId ?? null,
		},
	} as any;
}

describe("tRPC procedure guards", () => {
	it("rejects protected procedures without a session", async () => {
		const caller = testRouter.createCaller({ session: null });
		await expect(caller.privatePing()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("rejects org procedures when no active organization is set", async () => {
		const caller = testRouter.createCaller({
			session: authedSession(null),
		});

		try {
			await caller.orgPing();
			throw new Error("Expected orgPing to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
		}
	});

	it("passes org procedures when user has an active organization", async () => {
		const caller = testRouter.createCaller({
			session: authedSession("org_123"),
		});

		await expect(caller.orgPing()).resolves.toBe("org_123");
	});
});
