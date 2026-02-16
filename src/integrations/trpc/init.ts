import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import type { auth } from "@/lib/auth"

export interface TRPCContext {
	session: Awaited<ReturnType<typeof auth.api.getSession>> | null
}

const t = initTRPC.context<TRPCContext>().create({
	transformer: superjson,
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.session?.user) {
		throw new TRPCError({ code: "UNAUTHORIZED" })
	}
	return next({
		ctx: {
			session: ctx.session as NonNullable<typeof ctx.session>,
		},
	})
})

export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	if (!ctx.session.session.activeOrganizationId) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "No active organization",
		})
	}
	return next({
		ctx: {
			...ctx,
			organizationId: ctx.session.session.activeOrganizationId,
		},
	})
})
