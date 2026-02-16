import { createTRPCRouter } from "./init"
import { standupsRouter } from "./routers/standups"
import { teamsRouter } from "./routers/teams"
import { orgRouter } from "./routers/org"

export const trpcRouter = createTRPCRouter({
	standups: standupsRouter,
	teams: teamsRouter,
	org: orgRouter,
})

export type TRPCRouter = typeof trpcRouter
