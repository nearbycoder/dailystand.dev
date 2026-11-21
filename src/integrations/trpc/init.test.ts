import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
	dbMock: {
		query: {
			member: {
				findFirst: vi.fn(),
			},
		},
	},
}));

vi.mock("@/db", () => ({
	db: dbMock,
}));

import { createTRPCRouter, orgProcedure, protectedProcedure } from "./init";
import type { TRPCContext } from "./init";

const testRouter = createTRPCRouter({
	privatePing: protectedProcedure.query(() => "ok"),
	orgPing: orgProcedure.query(({ ctx }) => ({
		organizationId: ctx.organizationId,
		membership: ctx.membership,
	})),
});

function authedSession(activeOrganizationId?: string | null) {
	const session: NonNullable<TRPCContext["session"]> = {
		user: {
			id: "user_1",
			email: "user@example.com",
			name: "User",
		},
		session: {
			activeOrganizationId: activeOrganizationId ?? null,
		},
	};
	return session;
}

describe("tRPC procedure guards", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

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

	it("rejects org procedures when user is no longer a member of the active organization", async () => {
		dbMock.query.member.findFirst.mockResolvedValue(null);
		const caller = testRouter.createCaller({
			session: authedSession("org_123"),
		});

		try {
			await caller.orgPing();
			throw new Error("Expected orgPing to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("FORBIDDEN");
		}
	});

	it("passes org procedures when user has an active organization membership", async () => {
		dbMock.query.member.findFirst.mockResolvedValue({
			id: "member_1",
			role: "admin",
		});
		const caller = testRouter.createCaller({
			session: authedSession("org_123"),
		});

		await expect(caller.orgPing()).resolves.toEqual({
			organizationId: "org_123",
			membership: {
				id: "member_1",
				role: "admin",
			},
		});
	});
});
