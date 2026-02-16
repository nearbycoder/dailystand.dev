import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => {
	const query = {
		member: {
			findFirst: vi.fn(),
		},
		user: {
			findFirst: vi.fn(),
		},
		teamMember: {
			findMany: vi.fn(),
		},
		standupEntry: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
		},
	};

	return {
		dbMock: {
			query,
			update: vi.fn(),
		},
	};
});

vi.mock("@/db", () => ({
	db: dbMock,
}));

import { createTRPCRouter } from "../init";
import type { TRPCContext } from "../init";
import { profileRouter } from "./profile";

const router = createTRPCRouter({
	profile: profileRouter,
});

function createCaller() {
	const session: NonNullable<TRPCContext["session"]> = {
		user: {
			id: "viewer_1",
			email: "viewer@example.com",
			name: "Viewer",
		},
		session: {
			activeOrganizationId: "org_1",
		},
	};

	return router.createCaller({
		session,
	});
}

describe("profile router", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns grouped profile history with pagination cursor", async () => {
		dbMock.query.member.findFirst
			.mockResolvedValueOnce({ id: "member_viewer" })
			.mockResolvedValueOnce({ role: "member", createdAt: new Date("2025-01-01") });
		dbMock.query.user.findFirst.mockResolvedValue({
			id: "user_2",
			name: "Target User",
			image: null,
			bio: "Builder",
			createdAt: new Date("2025-01-01"),
		});
		dbMock.query.teamMember.findMany.mockResolvedValue([
			{
				id: "tm_1",
				teamId: "team_1",
				createdAt: new Date("2025-01-10"),
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
				content: "Shipped profile API",
				teamId: "team_1",
				createdAt: new Date("2026-02-15T10:00:00Z"),
				team: { id: "team_1", name: "Platform" },
			},
			{
				id: 2,
				date: "2026-02-14",
				type: "planned",
				content: "Wire profile page",
				teamId: "team_1",
				createdAt: new Date("2026-02-14T10:00:00Z"),
				team: { id: "team_1", name: "Platform" },
			},
		]);
		dbMock.query.standupEntry.findFirst.mockResolvedValue({ id: 999 });

		const result = await createCaller().profile.getUserProfile({
			userId: "user_2",
			limit: 1,
		});

		expect(result.user).toMatchObject({
			id: "user_2",
			name: "Target User",
			bio: "Builder",
		});
		expect(result.teamMemberships).toEqual([
			{
				id: "tm_1",
				teamId: "team_1",
				teamName: "Platform",
				joinedAt: new Date("2025-01-10"),
			},
		]);
		expect(result.history.days).toHaveLength(1);
		expect(result.history.days[0]).toMatchObject({
			date: "2026-02-15",
			completed: ["Shipped profile API"],
			planned: [],
			blockers: [],
		});
		expect(result.history.hasMore).toBe(true);
		expect(result.history.nextCursorDate).toBe("2026-02-15");
	});

	it("throws forbidden if viewer is not in active org", async () => {
		dbMock.query.member.findFirst
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ role: "member", createdAt: new Date("2025-01-01") });
		dbMock.query.user.findFirst.mockResolvedValue({
			id: "user_2",
			name: "Target User",
			image: null,
			bio: null,
			createdAt: new Date("2025-01-01"),
		});

		try {
			await createCaller().profile.getUserProfile({
				userId: "user_2",
				limit: 20,
			});
			throw new Error("Expected getUserProfile to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("FORBIDDEN");
		}
	});

	it("throws not found when target user is not in active org", async () => {
		dbMock.query.member.findFirst
			.mockResolvedValueOnce({ id: "member_viewer" })
			.mockResolvedValueOnce(null);
		dbMock.query.user.findFirst.mockResolvedValue({
			id: "user_2",
			name: "Target User",
			image: null,
			bio: null,
			createdAt: new Date("2025-01-01"),
		});

		try {
			await createCaller().profile.getUserProfile({
				userId: "user_2",
				limit: 20,
			});
			throw new Error("Expected getUserProfile to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("NOT_FOUND");
		}
	});

	it("normalizes bio updates", async () => {
		dbMock.query.member.findFirst.mockResolvedValue({ id: "member_viewer" });
		const whereMock = vi.fn().mockResolvedValue(undefined);
		const setMock = vi.fn().mockReturnValue({
			where: whereMock,
		});
		dbMock.update.mockReturnValue({
			set: setMock,
		});

		const result = await createCaller().profile.updateMyBio({
			bio: "  working across platform + infra  ",
		});

		expect(result).toEqual({ bio: "working across platform + infra" });
		expect(setMock).toHaveBeenCalledWith(
			expect.objectContaining({
				bio: "working across platform + infra",
				updatedAt: expect.any(Date),
			}),
		);
	});

	it("filters team memberships to active org and ends pagination when exhausted", async () => {
		dbMock.query.member.findFirst
			.mockResolvedValueOnce({ id: "member_viewer" })
			.mockResolvedValueOnce({ role: "member", createdAt: new Date("2025-01-01") });
		dbMock.query.user.findFirst.mockResolvedValue({
			id: "user_2",
			name: "Target User",
			image: null,
			bio: null,
			createdAt: new Date("2025-01-01"),
		});
		dbMock.query.teamMember.findMany.mockResolvedValue([
			{
				id: "tm_1",
				teamId: "team_1",
				createdAt: new Date("2025-01-10"),
				team: {
					id: "team_1",
					name: "Platform",
					organizationId: "org_1",
				},
			},
			{
				id: "tm_2",
				teamId: "team_2",
				createdAt: new Date("2025-01-11"),
				team: {
					id: "team_2",
					name: "Other Org Team",
					organizationId: "org_2",
				},
			},
		]);
		dbMock.query.standupEntry.findMany.mockResolvedValue([
			{
				id: 1,
				date: "2026-02-15",
				type: "completed",
				content: "Finished profile route",
				teamId: "team_1",
				createdAt: new Date("2026-02-15T10:00:00Z"),
				team: { id: "team_1", name: "Platform" },
			},
		]);
		dbMock.query.standupEntry.findFirst.mockResolvedValue(null);

		const result = await createCaller().profile.getUserProfile({
			userId: "user_2",
			limit: 1,
		});

		expect(result.teamMemberships).toEqual([
			{
				id: "tm_1",
				teamId: "team_1",
				teamName: "Platform",
				joinedAt: new Date("2025-01-10"),
			},
		]);
		expect(result.history.hasMore).toBe(false);
		expect(result.history.nextCursorDate).toBeNull();
	});

	it("rejects invalid cursor dates", async () => {
		try {
			await createCaller().profile.getUserProfile({
				userId: "user_2",
				limit: 20,
				cursorDate: "02-16-2026",
			});
			throw new Error("Expected getUserProfile to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("BAD_REQUEST");
		}
	});

	it("blocks bio updates when viewer is not in the active org", async () => {
		dbMock.query.member.findFirst.mockResolvedValue(null);

		try {
			await createCaller().profile.updateMyBio({
				bio: "new bio",
			});
			throw new Error("Expected updateMyBio to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("FORBIDDEN");
		}
	});

	it("normalizes blank bio values to null", async () => {
		dbMock.query.member.findFirst.mockResolvedValue({ id: "member_viewer" });
		const whereMock = vi.fn().mockResolvedValue(undefined);
		const setMock = vi.fn().mockReturnValue({
			where: whereMock,
		});
		dbMock.update.mockReturnValue({
			set: setMock,
		});

		const result = await createCaller().profile.updateMyBio({
			bio: "   ",
		});

		expect(result).toEqual({ bio: null });
		expect(setMock).toHaveBeenCalledWith(
			expect.objectContaining({
				bio: null,
				updatedAt: expect.any(Date),
			}),
		);
	});
});
