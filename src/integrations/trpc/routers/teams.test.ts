import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
	dbMock: {
		query: {
			team: {
				findMany: vi.fn(),
				findFirst: vi.fn(),
			},
			teamMember: {
				findMany: vi.fn(),
			},
		},
	},
}));

vi.mock("@/db", () => ({
	db: dbMock,
}));

import { createTRPCRouter } from "../init";
import { teamsRouter } from "./teams";
import type { TRPCContext } from "../init";

const router = createTRPCRouter({
	teams: teamsRouter,
});

function createCaller() {
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

describe("teams router", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("lists teams with member count and member summaries", async () => {
		dbMock.query.team.findMany.mockResolvedValue([
			{
				id: "team_1",
				name: "Platform",
				teamMembers: [
					{
						user: {
							id: "u_1",
							name: "A",
							image: null,
						},
					},
					{
						user: {
							id: "u_2",
							name: "B",
							image: "img.png",
						},
					},
				],
			},
		]);

		const result = await createCaller().teams.list();
		expect(result).toEqual([
			{
				id: "team_1",
				name: "Platform",
				memberCount: 2,
				members: [
					{
						id: "u_1",
						name: "A",
						image: null,
					},
					{
						id: "u_2",
						name: "B",
						image: "img.png",
					},
				],
			},
		]);
	});

	it("returns an empty list when getMembers team is out of organization scope", async () => {
		dbMock.query.team.findFirst.mockResolvedValue(null);

		const result = await createCaller().teams.getMembers({
			teamId: "other_org_team",
		});
		expect(result).toEqual([]);
	});

	it("returns members for in-scope teams", async () => {
		dbMock.query.team.findFirst.mockResolvedValue({
			id: "team_1",
		});
		dbMock.query.teamMember.findMany.mockResolvedValue([
			{
				user: {
					id: "u_1",
					name: "Alex",
					email: "alex@example.com",
					image: null,
				},
			},
		]);

		const result = await createCaller().teams.getMembers({
			teamId: "team_1",
		});
		expect(result).toEqual([
			{
				id: "u_1",
				name: "Alex",
				email: "alex@example.com",
				image: null,
			},
		]);
	});
});
