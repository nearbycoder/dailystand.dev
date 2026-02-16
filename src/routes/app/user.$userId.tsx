import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	CheckCircle2,
	Clock3,
	Target,
	Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AutoLinkText } from "@/components/auto-link-text";
import { useTRPC } from "@/integrations/trpc/react";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/app/user/$userId")({
	component: UserProfileRoute,
});

const HISTORY_PAGE_SIZE = 20;

function formatDate(dateLike: string | Date | null | undefined) {
	if (!dateLike) return "UNKNOWN";
	const value =
		typeof dateLike === "string" ? `${dateLike}T12:00:00` : dateLike;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return "UNKNOWN";
	return parsed.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatDateHeading(dateLike: string) {
	const parsed = new Date(`${dateLike}T12:00:00`);
	return parsed
		.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		})
		.toUpperCase();
}

function getInitials(name: string) {
	return name
		.split(" ")
		.filter(Boolean)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function UserProfileRoute() {
	const { userId } = Route.useParams();
	return <UserProfilePage key={userId} userId={userId} />;
}

function UserProfilePage({ userId }: { userId: string }) {
	const trpc = useTRPC();
	const { data: session } = authClient.useSession();
	const [cursorDate, setCursorDate] = useState<string | undefined>(undefined);
	const [historyDays, setHistoryDays] = useState<
		Array<{
			date: string;
			completed: string[];
			planned: string[];
			blockers: string[];
			entries: Array<{
				id: number;
				type: "completed" | "planned" | "blocker";
				content: string;
				teamId: string | null;
				teamName: string | null;
				createdAt: Date;
			}>;
		}>
	>([]);
	const [nextCursorDate, setNextCursorDate] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const consumedCursorsRef = useRef<Set<string>>(new Set());

	const profileQuery = useQuery({
		...trpc.profile.getUserProfile.queryOptions({
			userId,
			limit: HISTORY_PAGE_SIZE,
			cursorDate,
		}),
		placeholderData: (previousData) => previousData,
	});

	useEffect(() => {
		if (!profileQuery.data) return;
		const cursorKey = cursorDate ?? "__initial__";
		if (consumedCursorsRef.current.has(cursorKey)) return;
		consumedCursorsRef.current.add(cursorKey);

		const incomingDays = profileQuery.data.history.days;
		setHistoryDays((previous) => {
			if (!cursorDate) return incomingDays;
			const knownDates = new Set(previous.map((day) => day.date));
			const deduped = incomingDays.filter((day) => !knownDates.has(day.date));
			return [...previous, ...deduped];
		});
		setHasMore(profileQuery.data.history.hasMore);
		setNextCursorDate(profileQuery.data.history.nextCursorDate);
	}, [profileQuery.data, cursorDate]);

	const loadMore = () => {
		if (!nextCursorDate || profileQuery.isFetching) return;
		setCursorDate(nextCursorDate);
	};

	const profile = profileQuery.data;
	const isSelf = profile?.user.id === session?.user?.id;

	if (profileQuery.isLoading && !profile) {
		return (
			<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
				<div className="h-36 animate-pulse border-[3px] border-ds-muted3 bg-ds-surface/20" />
				<div className="mt-4 h-56 animate-pulse border-[3px] border-ds-muted3 bg-ds-surface/20" />
			</div>
		);
	}

	if (profileQuery.isError || !profile) {
		return (
			<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
				<div className="border-[3px] border-red-500/60 bg-red-500/5 px-4 py-3 text-sm text-red-400">
					PROFILE_LOAD_ERROR //{" "}
					{profileQuery.error instanceof Error
						? profileQuery.error.message
						: "Unable to load this profile."}
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			<div className="mb-6 flex flex-wrap items-start justify-between gap-3">
				<div className="flex items-center gap-3">
					<div className="flex h-12 w-12 items-center justify-center bg-ds-accent text-sm font-extrabold text-ds-accent-fg">
						{getInitials(profile.user.name)}
					</div>
					<div>
						<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
							{profile.user.name.toUpperCase()}
						</h1>
						<p className="mt-1 text-sm text-ds-muted">
							// ADDED_TO_ORG {formatDate(profile.organizationMembership.joinedAt)}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{isSelf ? (
						<Link
							to="/app/settings/profile"
							className="border-[2px] border-ds-muted3 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
						>
							EDIT_BIO
						</Link>
					) : null}
					<Link
						to="/app/history"
						className="border-[2px] border-ds-muted3 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
					>
						MY_HISTORY
					</Link>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div className="border-[3px] border-ds-muted3 p-4 lg:col-span-2">
					<div className="mb-2 text-xs font-extrabold tracking-widest text-ds-text-tertiary">
						// BIO
					</div>
					{profile.user.bio ? (
						<p className="whitespace-pre-wrap text-sm leading-relaxed text-ds-text-secondary">
							{profile.user.bio}
						</p>
					) : (
						<p className="text-sm text-ds-muted">// no bio set yet</p>
					)}
				</div>

				<div className="border-[3px] border-ds-muted3 p-4">
					<div className="mb-2 flex items-center gap-2 text-xs font-extrabold tracking-widest text-ds-text-tertiary">
						<Users className="h-3.5 w-3.5" />
						TEAM_MEMBERSHIPS
					</div>
					{profile.teamMemberships.length > 0 ? (
						<div className="space-y-2">
							{profile.teamMemberships.map((membership) => (
								<Link
									key={membership.id}
									to="/app/team/$teamId"
									params={{ teamId: membership.teamId }}
									className="group block border-[2px] border-ds-border px-2 py-1.5 transition-colors hover:border-ds-accent/70 focus-visible:border-ds-accent focus-visible:outline-none"
								>
									<div className="text-xs font-bold text-ds-text-secondary transition-colors group-hover:text-ds-fg">
										{membership.teamName}
									</div>
									<div className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
										SINCE {formatDate(membership.joinedAt)}
									</div>
								</Link>
							))}
						</div>
					) : (
						<p className="text-xs text-ds-muted">// no team assignments</p>
					)}
				</div>
			</div>

			<div className="mt-6 border-[3px] border-ds-muted3">
				<div className="border-b-[3px] border-ds-muted3 px-4 py-3 sm:px-5">
					<div className="flex items-center justify-between gap-2">
						<div>
							<h2 className="text-sm font-extrabold tracking-wider">STANDUP_HISTORY</h2>
							<p className="mt-1 text-[11px] text-ds-text-tertiary">
								READ_ONLY_TIMELINE
							</p>
						</div>
						<div className="text-[10px] font-extrabold tracking-widest text-ds-text-tertiary">
							{historyDays.length} DAYS_LOADED
						</div>
					</div>
				</div>

				{historyDays.length > 0 ? (
					<div>
						{historyDays.map((day) => (
							<div
								key={day.date}
								className="border-b-[2px] border-ds-muted3/70 px-4 py-4 last:border-b-0 sm:px-5"
							>
								<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
									<div className="text-sm font-extrabold tracking-wider">
										{formatDateHeading(day.date)}
									</div>
									<div className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
										{day.entries.length} ENTRIES
									</div>
								</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
									<HistoryColumn
										icon={<CheckCircle2 className="h-3 w-3" />}
										label="DONE"
										color="lime"
										items={day.completed}
									/>
									<HistoryColumn
										icon={<Target className="h-3 w-3" />}
										label="NEXT"
										color="cyan"
										items={day.planned}
									/>
									<HistoryColumn
										icon={<AlertTriangle className="h-3 w-3" />}
										label="BLOCKED"
										color="red"
										items={day.blockers}
									/>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="px-4 py-4 text-sm text-ds-muted sm:px-5">
						// no standup history available
					</div>
				)}
			</div>

			<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-ds-text-tertiary">
					<Clock3 className="h-3.5 w-3.5" />
					MEMBER_SINCE {formatDate(profile.organizationMembership.joinedAt)}
				</div>
				{hasMore ? (
					<button
						type="button"
						onClick={loadMore}
						disabled={profileQuery.isFetching}
						className="border-[2px] border-ds-muted3 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent disabled:cursor-not-allowed disabled:opacity-60"
					>
						{profileQuery.isFetching ? "LOADING..." : "LOAD_MORE"}
					</button>
				) : (
					<span className="text-[10px] font-bold tracking-widest text-ds-muted">
						END_OF_HISTORY
					</span>
				)}
			</div>
		</div>
	);
}

const colorMap = {
	lime: {
		border: "border-l-lime-600 dark:border-l-lime-400",
		bg: "bg-lime-500/5 dark:bg-lime-400/5",
		text: "text-lime-600 dark:text-lime-400",
		link: "underline decoration-lime-500/60 underline-offset-2 transition-colors hover:text-lime-600 hover:decoration-lime-500 dark:hover:text-lime-400",
	},
	cyan: {
		border: "border-l-cyan-600 dark:border-l-cyan-400",
		bg: "bg-cyan-500/5 dark:bg-cyan-400/5",
		text: "text-cyan-600 dark:text-cyan-400",
		link: "underline decoration-cyan-500/60 underline-offset-2 transition-colors hover:text-cyan-600 hover:decoration-cyan-500 dark:hover:text-cyan-400",
	},
	red: {
		border: "border-l-red-500 dark:border-l-red-400",
		bg: "bg-red-500/5 dark:bg-red-400/5",
		text: "text-red-500 dark:text-red-400",
		link: "underline decoration-red-500 dark:decoration-red-400 underline-offset-2 transition-colors hover:text-red-500 hover:decoration-red-500 dark:hover:text-red-400",
	},
} as const;

function HistoryColumn({
	icon,
	label,
	color,
	items,
}: {
	icon: React.ReactNode;
	label: string;
	color: "lime" | "cyan" | "red";
	items: string[];
}) {
	const c = colorMap[color];

	return (
		<div>
			<div className="mb-2 flex items-center gap-1.5">
				<span className={c.text}>{icon}</span>
				<span className={`text-[10px] font-extrabold tracking-widest ${c.text}`}>
					{label}
				</span>
				<span className="text-[10px] font-bold text-ds-text-tertiary">
					{items.length}
				</span>
			</div>
			{items.length > 0 ? (
				<ul className="space-y-1.5">
					{items.map((item, index) => (
						<li
							key={`${label}-${item}-${index}`}
							className={`border-l-[2px] ${c.border} ${c.bg} px-2.5 py-1.5 text-xs text-ds-text-secondary`}
						>
							<AutoLinkText text={item} linkClassName={c.link} />
						</li>
					))}
				</ul>
			) : (
				<div className="text-xs text-ds-muted">// none</div>
			)}
		</div>
	);
}
