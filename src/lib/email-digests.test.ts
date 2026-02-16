import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	dbMock,
	isResendConfiguredMock,
	sendResendEmailMessageMock,
	resolveOrganizationPlanLimitsMock,
	renderMock,
} = vi.hoisted(() => ({
	dbMock: {
		query: {
			emailDigestPreference: {
				findMany: vi.fn(),
			},
			member: {
				findFirst: vi.fn(),
			},
			teamMember: {
				findMany: vi.fn(),
			},
			standupEntry: {
				findMany: vi.fn(),
			},
		},
		update: vi.fn(),
	},
	isResendConfiguredMock: vi.fn(),
	sendResendEmailMessageMock: vi.fn(),
	resolveOrganizationPlanLimitsMock: vi.fn(),
	renderMock: vi.fn(),
}));

vi.mock("@/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/email", () => ({
	isResendConfigured: isResendConfiguredMock,
	sendResendEmailMessage: sendResendEmailMessageMock,
}));

vi.mock("@/lib/plan-limits", () => ({
	resolveOrganizationPlanLimits: resolveOrganizationPlanLimitsMock,
}));

vi.mock("@react-email/render", () => ({
	render: renderMock,
}));

import { runDigestWorkflow } from "./email-digests";

describe("runDigestWorkflow", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns immediately when resend is not configured", async () => {
		isResendConfiguredMock.mockReturnValue(false);

		const result = await runDigestWorkflow("daily", new Date("2026-02-16T12:00:00Z"));
		expect(result).toEqual({
			cadence: "daily",
			attempted: 0,
			sent: 0,
			skipped: 0,
			errors: [],
		});
		expect(dbMock.query.emailDigestPreference.findMany).not.toHaveBeenCalled();
	});

	it("skips preferences when user is no longer an org member", async () => {
		isResendConfiguredMock.mockReturnValue(true);
		dbMock.query.emailDigestPreference.findMany.mockResolvedValue([
			{
				id: 1,
				userId: "user_1",
				organizationId: "org_1",
				cadence: "daily",
				timezone: "UTC",
				lastDailySentAt: null,
				lastWeeklySentAt: null,
				user: { id: "user_1", name: "Alex", email: "alex@example.com" },
				organization: { id: "org_1", name: "Acme" },
			},
		]);
		dbMock.query.member.findFirst.mockResolvedValue(null);

		const result = await runDigestWorkflow("daily", new Date("2026-02-16T12:00:00Z"));
		expect(result).toEqual({
			cadence: "daily",
			attempted: 1,
			sent: 0,
			skipped: 1,
			errors: [],
		});
		expect(sendResendEmailMessageMock).not.toHaveBeenCalled();
	});

	it("skips daily sends for free plans", async () => {
		isResendConfiguredMock.mockReturnValue(true);
		dbMock.query.emailDigestPreference.findMany.mockResolvedValue([
			{
				id: 1,
				userId: "user_1",
				organizationId: "org_1",
				cadence: "daily",
				timezone: "UTC",
				lastDailySentAt: null,
				lastWeeklySentAt: null,
				user: { id: "user_1", name: "Alex", email: "alex@example.com" },
				organization: { id: "org_1", name: "Acme" },
			},
		]);
		dbMock.query.member.findFirst.mockResolvedValue({ id: "member_1" });
		resolveOrganizationPlanLimitsMock.mockResolvedValue({
			plan: "free",
		});

		const result = await runDigestWorkflow("daily", new Date("2026-02-16T12:00:00Z"));
		expect(result).toEqual({
			cadence: "daily",
			attempted: 1,
			sent: 0,
			skipped: 1,
			errors: [],
		});
		expect(sendResendEmailMessageMock).not.toHaveBeenCalled();
	});

	it("sends digest and updates last-sent timestamp when data exists", async () => {
		isResendConfiguredMock.mockReturnValue(true);
		renderMock.mockResolvedValue("<html>digest</html>");
		sendResendEmailMessageMock.mockResolvedValue(undefined);

		dbMock.query.emailDigestPreference.findMany.mockResolvedValue([
			{
				id: 11,
				userId: "user_1",
				organizationId: "org_1",
				cadence: "daily",
				timezone: "UTC",
				lastDailySentAt: null,
				lastWeeklySentAt: null,
				user: { id: "user_1", name: "Alex", email: "alex@example.com" },
				organization: { id: "org_1", name: "Acme" },
			},
		]);
		dbMock.query.member.findFirst.mockResolvedValue({ id: "member_1" });
		resolveOrganizationPlanLimitsMock.mockResolvedValue({
			plan: "pro",
		});
		dbMock.query.teamMember.findMany.mockResolvedValue([
			{
				teamId: "team_1",
				team: {
					id: "team_1",
					name: "Platform",
					organizationId: "org_1",
				},
			},
		]);
		dbMock.query.standupEntry.findMany.mockResolvedValue([
			{
				id: 1,
				date: "2026-02-15",
				type: "completed",
				content: "Finished API docs pagination",
				userId: "user_1",
				teamId: "team_1",
				user: { name: "Alex" },
				team: { name: "Platform" },
			},
			{
				id: 2,
				date: "2026-02-15",
				type: "planned",
				content: "Add dashboard regressions suite",
				userId: "user_1",
				teamId: "team_1",
				user: { name: "Alex" },
				team: { name: "Platform" },
			},
		]);

		const whereMock = vi.fn().mockResolvedValue(undefined);
		const setMock = vi.fn().mockReturnValue({
			where: whereMock,
		});
		dbMock.update.mockReturnValue({
			set: setMock,
		});

		const now = new Date("2026-02-16T12:00:00Z");
		const result = await runDigestWorkflow("daily", now);

		expect(result).toEqual({
			cadence: "daily",
			attempted: 1,
			sent: 1,
			skipped: 0,
			errors: [],
		});
		expect(sendResendEmailMessageMock).toHaveBeenCalledTimes(1);
		expect(sendResendEmailMessageMock).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "alex@example.com",
				subject: "[DailyStand] Daily digest • Acme",
				html: "<html>digest</html>",
			}),
		);
		expect(dbMock.update).toHaveBeenCalledTimes(1);
		expect(setMock).toHaveBeenCalledWith(
			expect.objectContaining({
				lastDailySentAt: now,
			}),
		);
	});
});
