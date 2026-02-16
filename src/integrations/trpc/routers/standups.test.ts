import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
	dbMock: {
		query: {
			teamMember: {
				findMany: vi.fn(),
				findFirst: vi.fn(),
			},
			team: {
				findFirst: vi.fn(),
			},
			member: {
				findFirst: vi.fn(),
			},
			standupEntry: {
				findFirst: vi.fn(),
				findMany: vi.fn(),
			},
			standupShare: {
				findFirst: vi.fn(),
				findMany: vi.fn(),
			},
		},
		delete: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock("@/db", () => ({
	db: dbMock,
}));

import { createTRPCRouter } from "../init";
import { standupsRouter } from "./standups";
import type { TRPCContext } from "../init";

const router = createTRPCRouter({
	standups: standupsRouter,
});

function createOrgCaller() {
	const session: NonNullable<TRPCContext["session"]> = {
		user: {
			id: "user_1",
			email: "dev@example.com",
			name: "Dev",
		},
		session: {
			activeOrganizationId: "org_1",
		},
	};

	return router.createCaller({
		session,
	});
}

function createPublicCaller() {
	return router.createCaller({
		session: null,
	});
}

describe("standups router", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("blocks upsert when user tries to submit for a team they are not in", async () => {
		dbMock.query.teamMember.findMany.mockResolvedValue([
			{
				teamId: "team_allowed",
				team: { organizationId: "org_1" },
			},
		]);

		try {
			await createOrgCaller().standups.upsert({
				date: "2026-02-16",
				teamId: "team_forbidden",
				entries: [{ type: "completed", content: "Shipped API docs changes" }],
			});
			throw new Error("Expected upsert to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("FORBIDDEN");
		}

		expect(dbMock.delete).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("reuses an existing active share token for the same day", async () => {
		dbMock.query.standupEntry.findFirst.mockResolvedValue({ id: 1 });
		dbMock.query.standupShare.findFirst.mockResolvedValue({
			id: 7,
			token: "existing_token_123",
			revokedAt: null,
			expiresAt: new Date("2030-01-01T00:00:00.000Z"),
		});

		const result = await createOrgCaller().standups.createDayShare({
			date: "2026-02-16",
		});

		expect(result).toEqual({
			token: "existing_token_123",
			urlPath: "/share/existing_token_123",
		});
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("rejects createDayShare when no standup exists for the requested day", async () => {
		dbMock.query.standupEntry.findFirst.mockResolvedValue(null);

		try {
			await createOrgCaller().standups.createDayShare({
				date: "2026-02-16",
			});
			throw new Error("Expected createDayShare to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("BAD_REQUEST");
		}
	});

	it("returns true/false for hasSubmittedToday based on standup existence", async () => {
		dbMock.query.standupEntry.findFirst
			.mockResolvedValueOnce({ id: 1 })
			.mockResolvedValueOnce(null);

		await expect(
			createOrgCaller().standups.hasSubmittedToday({ date: "2026-02-16" }),
		).resolves.toBe(true);
		await expect(
			createOrgCaller().standups.hasSubmittedToday({ date: "2026-02-17" }),
		).resolves.toBe(false);
	});

	it("returns NOT_FOUND for unknown or expired shared tokens", async () => {
		dbMock.query.standupShare.findFirst.mockResolvedValue(null);

		try {
			await createPublicCaller().standups.getSharedByToken({
				token: "a".repeat(16),
			});
			throw new Error("Expected getSharedByToken to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("NOT_FOUND");
		}
	});
});
