import { createFileRoute, Link } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { authClient } from "@/lib/auth-client"
import { getLocalDateString } from "@/lib/date"
import { AutoLinkText } from "@/components/auto-link-text"
import { useQueries, useQuery } from "@tanstack/react-query"
import { useMemo, type ReactNode } from "react"
import type { inferRouterOutputs } from "@trpc/server"
import type { TRPCRouter } from "@/integrations/trpc/router"
import {
	AlertTriangle,
	CheckCircle2,
	PenSquare,
	Target,
	Users,
	ArrowRight,
} from "lucide-react"

export const Route = createFileRoute("/app/")({
	component: DashboardHome,
})

type RouterOutputs = inferRouterOutputs<TRPCRouter>
type TeamStandup = RouterOutputs["standups"]["getByDate"][number]

function formatFullDate(dateStr: string): string {
	return new Date(`${dateStr}T12:00:00`)
		.toLocaleDateString("en-US", {
			weekday: "long",
			month: "long",
			day: "numeric",
			year: "numeric",
		})
		.toUpperCase()
}

function getStandupItemCount(standup: TeamStandup): number {
	return standup.completed.length + standup.planned.length + standup.blockers.length
}

function DashboardHome() {
	const trpc = useTRPC()
	const today = useMemo(() => getLocalDateString(), [])
	const { data: session } = authClient.useSession()
	const viewerId = session?.user?.id

	const { data: teams, isLoading: teamsLoading } = useQuery(
		trpc.teams.list.queryOptions(),
	)
	const { data: hasSubmitted } = useQuery(
		trpc.standups.hasSubmittedToday.queryOptions({ date: today }),
	)

	const myTeams = useMemo(() => {
		if (!teams || !viewerId) return []
		return teams.filter((team) =>
			team.members.some((member) => member.id === viewerId),
		)
	}, [teams, viewerId])

	const teamStandupQueries = useQueries({
		queries: myTeams.map((team) =>
			trpc.standups.getByDate.queryOptions({
				date: today,
				teamId: team.id,
			}),
		),
	})

	const hasTeamStandupError = teamStandupQueries.some((query) => query.isError)

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			<div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
						DASHBOARD
					</h1>
					<p className="mt-1 text-sm text-ds-muted">
						// {formatFullDate(today)}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Link
						to="/app/analytics"
						className="inline-flex items-center gap-1 border-[2px] border-ds-muted3 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
					>
						VIEW_ANALYTICS
						<ArrowRight className="h-3 w-3" />
					</Link>
					<Link
						to="/app/standup"
						className="inline-flex items-center gap-2 bg-ds-accent px-4 py-2 text-[10px] font-extrabold tracking-widest text-ds-accent-fg transition-colors hover:bg-ds-accent-hover"
					>
						<PenSquare className="h-3.5 w-3.5" />
						{hasSubmitted ? "UPDATE_STANDUP" : "SUBMIT_STANDUP"}
					</Link>
				</div>
			</div>

			{teamsLoading ? (
				<div className="space-y-4">
					{[1, 2, 3].map((row) => (
						<div
							key={row}
							className="h-36 animate-pulse border-[3px] border-ds-muted3 bg-ds-surface/20"
						/>
					))}
				</div>
			) : myTeams.length === 0 ? (
				<div className="border-[3px] border-ds-muted3 p-6">
					<div className="mb-2 flex items-center gap-2 text-ds-text-secondary">
						<Users className="h-4 w-4" />
						<span className="text-sm font-extrabold tracking-widest">NO_ASSIGNED_TEAMS</span>
					</div>
					<p className="text-sm text-ds-muted">
						You are in this organization, but not assigned to any team yet.
					</p>
					<Link
						to="/app/settings/teams"
						className="mt-4 inline-flex items-center gap-2 border-[2px] border-ds-muted3 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
					>
						MANAGE_TEAMS
					</Link>
				</div>
			) : (
				<div className="space-y-0">
						{myTeams.map((team, index) => {
							const teamQuery = teamStandupQueries[index]
							const standups: TeamStandup[] = teamQuery?.data ?? []
							const sortedStandups = [...standups].sort((a, b) => {
							if (a.user.id === viewerId && b.user.id !== viewerId) return -1
							if (b.user.id === viewerId && a.user.id !== viewerId) return 1
							return a.user.name.localeCompare(b.user.name)
						})
						const ownStandup = standups.find(
							(standup) =>
								standup.user.id === viewerId && getStandupItemCount(standup) > 0,
						)

						return (
							<div key={team.id} className="-mt-[3px] border-[3px] border-ds-muted3">
								<div className="flex flex-col gap-2 border-b-[3px] border-ds-muted3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
									<div className="min-w-0">
										<Link
											to="/app/team/$teamId"
											params={{ teamId: team.id }}
											className="inline-flex max-w-full items-center gap-2 text-sm font-extrabold tracking-wider text-ds-fg transition-colors hover:text-ds-accent"
										>
											{team.name.toUpperCase()}
											<ArrowRight className="h-3.5 w-3.5" />
										</Link>
										<p className="mt-1 text-[11px] text-ds-text-tertiary">
											{team.memberCount} MEMBERS
										</p>
									</div>
									<div className="flex items-center gap-2 text-[10px] font-extrabold tracking-widest">
										{teamQuery?.isLoading ? (
											<span className="text-ds-muted">LOADING...</span>
										) : (
											<>
												<span className="text-ds-text-tertiary">
													{standups.length} UPDATES
												</span>
												<span
													className={
														ownStandup
															? "text-ds-accent"
															: "text-ds-muted"
													}
												>
													{ownStandup ? "YOU_SUBMITTED" : "YOU_MISSING"}
												</span>
											</>
										)}
									</div>
								</div>

								{teamQuery?.isLoading ? (
									<div className="h-28 animate-pulse bg-ds-surface/20" />
								) : sortedStandups.length === 0 ? (
									<div className="px-4 py-3 text-xs text-ds-muted2 sm:px-5">
										// no team submissions for today
									</div>
								) : (
									<div>
										{sortedStandups.map((standup) => (
											<div
												key={standup.user.id}
												className="border-b-[2px] border-ds-muted3/70 px-4 py-4 last:border-b-0 sm:px-5"
											>
												<div className="mb-4 flex items-center gap-3">
													<div className="flex h-7 w-7 items-center justify-center bg-ds-accent text-[10px] font-extrabold text-ds-accent-fg">
														{standup.user.name
															.split(" ")
															.map((namePart) => namePart[0])
															.join("")
															.toUpperCase()}
													</div>
													<span className="text-sm font-bold tracking-wider">
														{standup.user.name.toUpperCase()}
													</span>
													{standup.user.id === viewerId && (
														<span className="border border-ds-accent bg-ds-accent/10 px-1.5 py-0.5 text-[9px] font-extrabold tracking-widest text-ds-accent">
															YOU
														</span>
													)}
												</div>
												<div className="grid grid-cols-1 gap-3 pl-0 sm:pl-10 md:grid-cols-3">
													{standup.completed.length > 0 && (
														<EntryColumn
															icon={<CheckCircle2 className="h-3 w-3" />}
															label="DONE"
															color="lime"
															items={standup.completed}
														/>
													)}
													{standup.planned.length > 0 && (
														<EntryColumn
															icon={<Target className="h-3 w-3" />}
															label="NEXT"
															color="cyan"
															items={standup.planned}
														/>
													)}
													{standup.blockers.length > 0 && (
														<EntryColumn
															icon={<AlertTriangle className="h-3 w-3" />}
															label="BLOCKED"
															color="red"
															items={standup.blockers}
														/>
													)}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						)
					})}
				</div>
			)}

			{hasTeamStandupError && (
				<p className="mt-4 text-xs font-bold tracking-wider text-red-500 dark:text-red-400">
					Unable to load one or more team standups for today.
				</p>
			)}
		</div>
	)
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
} as const

function EntryColumn({
	icon,
	label,
	color,
	items,
}: {
	icon: ReactNode
	label: string
	color: "lime" | "cyan" | "red"
	items: string[]
}) {
	const c = colorMap[color]

	return (
		<div>
			<div className="mb-2 flex items-center gap-1.5">
				<span className={c.text}>{icon}</span>
				<span className={`text-[10px] font-extrabold tracking-widest ${c.text}`}>
					{label}
				</span>
				<span className="text-[10px] font-bold text-ds-text-tertiary">{items.length}</span>
			</div>
			<div className="space-y-1.5">
				{items.map((item, index) => (
					<div key={index} className={`border-l-[2px] ${c.border} ${c.bg} px-2.5 py-1.5`}>
						<span className="break-words text-xs leading-relaxed text-ds-text-secondary">
							<AutoLinkText text={item} linkClassName={c.link} />
						</span>
					</div>
				))}
			</div>
		</div>
	)
}
