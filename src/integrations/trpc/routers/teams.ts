import { z } from "zod"
import { orgProcedure } from "../init"
import { db } from "@/db"
import { team, teamMember, user } from "@/db/schema"
import { eq, and } from "drizzle-orm"

export const teamsRouter = {
	list: orgProcedure.query(async ({ ctx }) => {
		const teams = await db.query.team.findMany({
			where: eq(team.organizationId, ctx.organizationId),
			with: {
				teamMembers: {
					with: {
						user: {
							columns: { id: true, name: true, image: true },
						},
					},
				},
			},
		})
		return teams.map((t) => ({
			id: t.id,
			name: t.name,
			memberCount: t.teamMembers.length,
			members: t.teamMembers.map((tm) => tm.user),
		}))
	}),

	getMembers: orgProcedure
		.input(z.object({ teamId: z.string() }))
		.query(async ({ input }) => {
			const members = await db.query.teamMember.findMany({
				where: eq(teamMember.teamId, input.teamId),
				with: {
					user: {
						columns: { id: true, name: true, email: true, image: true },
					},
				},
			})
			return members.map((m) => m.user)
		}),
}
