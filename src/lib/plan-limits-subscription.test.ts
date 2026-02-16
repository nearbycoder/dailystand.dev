import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
	dbMock: {
		query: {
			subscription: {
				findMany: vi.fn(),
			},
		},
	},
}));

vi.mock("@/db", () => ({
	db: dbMock,
}));

import { resolveOrganizationPlanLimits } from "./plan-limits";

describe("resolveOrganizationPlanLimits", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns free limits when organization has no subscription", async () => {
		dbMock.query.subscription.findMany.mockResolvedValue([]);

		const result = await resolveOrganizationPlanLimits({
			organizationId: "org_1",
			userId: "user_1",
			userIds: ["user_2"],
		});

		expect(result).toMatchObject({
			subscription: null,
			scope: "none",
			plan: "free",
			referenceId: null,
			limits: {
				teams: 1,
				members: 5,
				historyDays: 7,
			},
		});
		expect(dbMock.query.subscription.findMany).toHaveBeenCalledTimes(1);
	});

	it("uses organization-scoped subscription when present", async () => {
		dbMock.query.subscription.findMany.mockResolvedValue([
			{
				id: "sub_1",
				plan: "pro",
				referenceId: "org_1",
				status: "active",
				periodEnd: new Date("2026-12-01T00:00:00Z"),
			},
		]);

		const result = await resolveOrganizationPlanLimits({
			organizationId: "org_1",
			userId: "user_1",
		});

		expect(result).toMatchObject({
			scope: "organization",
			plan: "pro",
			referenceId: "org_1",
			limits: {
				teams: -1,
				members: 15,
				historyDays: 90,
			},
		});
	});
});
