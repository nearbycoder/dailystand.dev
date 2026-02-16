import { TRPCError } from "@trpc/server";
import { describe, expect, it, beforeEach, vi } from "vitest";

const { dbMock, resolveOrganizationPlanLimitsMock } = vi.hoisted(() => {
	const query = {
		organization: {
			findFirst: vi.fn(),
		},
		member: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
		},
		emailDigestPreference: {
			findFirst: vi.fn(),
		},
	};

	return {
		dbMock: {
			query,
			update: vi.fn(),
			insert: vi.fn(),
		},
		resolveOrganizationPlanLimitsMock: vi.fn(),
	};
});

vi.mock("@/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/plan-limits", () => ({
	resolveOrganizationPlanLimits: resolveOrganizationPlanLimitsMock,
}));

import { createTRPCRouter } from "../init";
import { orgRouter } from "./org";

const router = createTRPCRouter({
	org: orgRouter,
});

function createCaller() {
	return router.createCaller({
		session: {
			user: {
				id: "user_1",
				email: "dev@example.com",
				name: "Dev",
			},
			session: {
				activeOrganizationId: "org_1",
			},
		} as any,
	});
}

describe("org router", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns default subscription fields when no subscription exists", async () => {
		resolveOrganizationPlanLimitsMock.mockResolvedValue({
			subscription: null,
			scope: "none",
			plan: "free",
			status: "active",
			referenceId: null,
			limits: {
				teams: 1,
				members: 5,
				historyDays: 7,
			},
		});

		const result = await createCaller().org.getSubscription();
		expect(result).toEqual({
			plan: "free",
			status: "active",
			limits: {
				teams: 1,
				members: 5,
				historyDays: 7,
			},
			scope: "none",
			referenceId: null,
			cancelAt: null,
			periodEnd: null,
			cancelAtPeriodEnd: false,
		});
	});

	it("forces weekly digest cadence for free plans", async () => {
		dbMock.query.emailDigestPreference.findFirst.mockResolvedValue({
			enabled: true,
			cadence: "daily",
			timezone: "America/Chicago",
		});
		resolveOrganizationPlanLimitsMock.mockResolvedValue({
			plan: "free",
		});

		const result = await createCaller().org.getEmailDigestPreference();
		expect(result).toEqual({
			enabled: true,
			cadence: "weekly",
			timezone: "America/Chicago",
			isDailyAllowed: false,
			plan: "free",
		});
	});

	it("rejects daily digest preference changes on free plans", async () => {
		resolveOrganizationPlanLimitsMock.mockResolvedValue({
			plan: "free",
		});

		try {
			await createCaller().org.updateEmailDigestPreference({
				enabled: true,
				cadence: "daily",
				timezone: "UTC",
			});
			throw new Error("Expected updateEmailDigestPreference to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("FORBIDDEN");
		}
	});

	it("updates existing digest preference records with trimmed timezone", async () => {
		resolveOrganizationPlanLimitsMock.mockResolvedValue({
			plan: "pro",
		});
		dbMock.query.emailDigestPreference.findFirst.mockResolvedValue({
			id: 42,
		});

		const whereMock = vi.fn().mockResolvedValue(undefined);
		const setMock = vi.fn().mockReturnValue({
			where: whereMock,
		});
		dbMock.update.mockReturnValue({
			set: setMock,
		});

		const result = await createCaller().org.updateEmailDigestPreference({
			enabled: true,
			cadence: "daily",
			timezone: "  America/New_York  ",
		});

		expect(dbMock.update).toHaveBeenCalledTimes(1);
		expect(setMock).toHaveBeenCalledWith(
			expect.objectContaining({
				enabled: true,
				cadence: "daily",
				timezone: "America/New_York",
				updatedAt: expect.any(Date),
			}),
		);
		expect(result).toEqual({
			enabled: true,
			cadence: "daily",
			timezone: "America/New_York",
			plan: "pro",
		});
	});

	it("throws forbidden when current user is not in the active organization", async () => {
		dbMock.query.member.findFirst.mockResolvedValue(null);

		try {
			await createCaller().org.getMyMembership();
			throw new Error("Expected getMyMembership to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("FORBIDDEN");
		}
	});
});
