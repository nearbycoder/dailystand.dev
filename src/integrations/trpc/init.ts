import { initTRPC, TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import superjson from "superjson";
import { db } from "@/db";
import { member } from "@/db/schema";

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
	const organizationId = ctx.session.session.activeOrganizationId;
	if (!organizationId) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "No active organization",
		});
	}

	const membership = await db.query.member.findFirst({
		where: and(
			eq(member.organizationId, organizationId),
			eq(member.userId, ctx.session.user.id),
		),
		columns: { id: true, role: true },
	});

	if (!membership) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You are not a member of the active organization.",
		});
	}

	return next({
		ctx: {
			...ctx,
			organizationId,
			membership,
		},
	});
});
