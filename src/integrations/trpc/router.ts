import { createTRPCRouter } from "./init";
import { orgRouter } from "./routers/org";
import { profileRouter } from "./routers/profile";
import { standupsRouter } from "./routers/standups";
import { teamsRouter } from "./routers/teams";

export const trpcRouter = createTRPCRouter({
	standups: standupsRouter,
	teams: teamsRouter,
	org: orgRouter,
	profile: profileRouter,
});

export type TRPCRouter = typeof trpcRouter;
