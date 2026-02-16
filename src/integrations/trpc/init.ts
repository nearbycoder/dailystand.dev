import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

export interface TRPCSession {
	user: {
		id: string;
		email: string;
		name: string | null;
		image?: string | null;
	};
	session: {
		activeOrganizationId?: string | null;
	};
}

export interface TRPCContext {
	session: TRPCSession | null;
}

const t = initTRPC.context<TRPCContext>().create({
	transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	const session = ctx.session;
	if (!session?.user) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({
		ctx: {
			session,
		},
	});
});

export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	if (!ctx.session.session.activeOrganizationId) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "No active organization",
		});
	}
	return next({
		ctx: {
			...ctx,
			organizationId: ctx.session.session.activeOrganizationId,
		},
	});
});
