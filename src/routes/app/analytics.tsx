import { createFileRoute, Link } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { getLocalDateString } from "@/lib/date"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import {
	ArrowRight,
	Building2,
	CalendarDays,
	CheckCircle2,
	FileDown,
	PenSquare,
	Target,
	TriangleAlert,
	TrendingDown,
	TrendingUp,
	UsersRound,
} from "lucide-react"

export const Route = createFileRoute("/app/analytics")({
	component: Dashboard,
})

const RANGE_OPTIONS = [
	{ value: 7 as const, label: "7D" },
	{ value: 14 as const, label: "14D" },
	{ value: 30 as const, label: "30D" },
	{ value: 60 as const, label: "60D" },
	{ value: 90 as const, label: "90D" },
]

type AnalyticsResponse = {
	period: {
		startDate: string
		endDate: string
		rangeDays: 7 | 14 | 30 | 60 | 90
	}
	scope: {
		teamId: string | null
		teamName: string | null
		members: number
		orgMembers: number
	}
	totals: {
		entries: number
		completed: number
		planned: number
		blockers: number
		blockerRate: number
		activeUsers: number
		activeTeams: number
		participationRate: number
	}
	insights: {
		completionDelta: number
		blockerDelta: number
	}
	dailyTrend: {
		date: string
		completed: number
		planned: number
		blockers: number
		total: number
		activeUsers: number
	}[]
	dailyDrilldown: {
		date: string
		total: number
		completed: number
		planned: number
		blockers: number
		activeUsers: number
		topContributors: {
			userId: string
			name: string
			entries: number
			completed: number
			planned: number
			blockers: number
		}[]
		sampleTasks: {
			type: "completed" | "planned" | "blocker"
			content: string
			userId: string
			userName: string
			teamId: string | null
			teamName: string
		}[]
	}[]
	teamStats: {
		teamId: string | null
		teamName: string
		memberCount: number
		activeUsers: number
		participationRate: number
		entries: number
		completed: number
		planned: number
		blockers: number
		blockerRate: number
		velocity: number
	}[]
	teamDrilldown: {
		teamId: string | null
		teamName: string
		entries: number
		completed: number
		planned: number
		blockers: number
		participationRate: number
		blockerRate: number
		topContributors: {
			userId: string
			name: string
			entries: number
			completed: number
			planned: number
			blockers: number
		}[]
		sampleTasks: {
			date: string
			type: "completed" | "planned" | "blocker"
			content: string
			userId: string
			userName: string
		}[]
	}[]
	topContributors: {
		userId: string
		name: string
		entries: number
		completed: number
		planned: number
		blockers: number
		daysPosted: number
		teams: number
	}[]
	contributorDrilldown: {
		userId: string
		name: string
		entries: number
		completed: number
		planned: number
		blockers: number
		daysPosted: number
		teams: number
		sampleTasks: {
			date: string
			type: "completed" | "planned" | "blocker"
			content: string
			teamId: string | null
			teamName: string
		}[]
	}[]
	blockerHotspots: {
		teamId: string | null
		teamName: string
		memberCount: number
		activeUsers: number
		participationRate: number
		entries: number
		completed: number
		planned: number
		blockers: number
		blockerRate: number
		velocity: number
	}[]
	keywords: {
		term: string
		count: number
	}[]
	keywordDrilldown: {
		term: string
		count: number
		uniquePeople: number
		samples: {
			date: string
			type: "completed" | "planned" | "blocker"
			content: string
			userId: string
			userName: string
		}[]
	}[]
}

function formatDate(dateString: string): string {
	return new Date(`${dateString}T12:00:00`).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	})
}

function formatPercent(value: number, decimals = 0): string {
	return `${(value * 100).toFixed(decimals)}%`
}

function formatDelta(value: number): string {
	const sign = value > 0 ? "+" : ""
	return `${sign}${(value * 100).toFixed(0)}%`
}

function shiftDate(dateString: string, offsetDays: number): string {
	const date = new Date(`${dateString}T12:00:00`)
	date.setDate(date.getDate() + offsetDays)
	return date.toISOString().split("T")[0]
}

function downloadTextFile(
	filename: string,
	content: string,
	mimeType: string,
) {
	if (typeof window === "undefined") return
	const blob = new Blob([content], { type: mimeType })
	const url = window.URL.createObjectURL(blob)
	const anchor = document.createElement("a")
	anchor.href = url
	anchor.download = filename
	document.body.appendChild(anchor)
	anchor.click()
	document.body.removeChild(anchor)
	window.URL.revokeObjectURL(url)
}

function Dashboard() {
	const trpc = useTRPC()
	const today = useMemo(() => getLocalDateString(), [])
	const defaultExportStart = useMemo(() => shiftDate(today, -29), [today])
	const [rangeDays, setRangeDays] = useState<7 | 14 | 30 | 60 | 90>(30)
	const [selectedTeamId, setSelectedTeamId] = useState("all")
	const [exportTeamId, setExportTeamId] = useState("all")
	const [exportStartDate, setExportStartDate] = useState(defaultExportStart)
	const [exportEndDate, setExportEndDate] = useState(today)
	const [activeOverlay, setActiveOverlay] = useState<
		"metrics" | "activity" | "teams" | "contributors" | "keywords" | null
	>(null)

	const { data: teams } = useQuery(trpc.teams.list.queryOptions())
	const { data: hasSubmitted } = useQuery(
		trpc.standups.hasSubmittedToday.queryOptions({ date: today }),
	)
	const analyticsQuery = useQuery(
		trpc.standups.getAnalytics.queryOptions({
			rangeDays,
			teamId: selectedTeamId === "all" ? undefined : selectedTeamId,
		}),
	)
	const exportMutation = useMutation(
		trpc.standups.exportRange.mutationOptions(),
	)
	const analytics = analyticsQuery.data as AnalyticsResponse | undefined

	useEffect(() => {
		if (selectedTeamId === "all") return
		if (!teams || teams.length === 0) return
		if (!teams.some((team) => team.id === selectedTeamId)) {
			setSelectedTeamId("all")
		}
	}, [selectedTeamId, teams])

	useEffect(() => {
		if (exportTeamId === "all") return
		if (!teams || teams.length === 0) return
		if (!teams.some((team) => team.id === exportTeamId)) {
			setExportTeamId("all")
		}
	}, [exportTeamId, teams])

	const teamOptions = useMemo(() => {
		const base = [{ id: "all", name: "ALL_TEAMS" }]
		if (!teams) return base
		return [
			...base,
			...teams.map((team) => ({ id: team.id, name: team.name.toUpperCase() })),
		]
	}, [teams])

	const periodLabel = analytics
		? `${formatDate(analytics.period.startDate)} - ${formatDate(analytics.period.endDate)}`
		: "ANALYZING..."

	const completionToPlanRatio = analytics
		? analytics.totals.planned > 0
			? analytics.totals.completed / analytics.totals.planned
			: analytics.totals.completed > 0
				? 1
				: 0
		: 0

	const recentTaskSamples = useMemo(() => {
		if (!analytics) return []
		return [...analytics.dailyDrilldown]
			.reverse()
			.flatMap((day) =>
				day.sampleTasks.map((task) => ({
					date: day.date,
					...task,
				})),
			)
			.slice(0, 24)
	}, [analytics])

	const handleExport = async (format: "markdown" | "csv") => {
		if (!exportStartDate || !exportEndDate) {
			toast.error("Missing date range", {
				description: "Please select both start and end dates before exporting.",
			})
			return
		}
		if (exportStartDate > exportEndDate) {
			toast.error("Invalid date range", {
				description: "Start date must be before or equal to end date.",
			})
			return
		}

		try {
			const result = await exportMutation.mutateAsync({
				startDate: exportStartDate,
				endDate: exportEndDate,
				teamId: exportTeamId === "all" ? undefined : exportTeamId,
				format,
			})

			downloadTextFile(result.filename, result.content, result.mimeType)
			toast.success(`${format.toUpperCase()} export downloaded`, {
				description: `${exportStartDate} to ${exportEndDate}`,
			})
		} catch (error) {
			toast.error("Export failed", {
				description:
					error instanceof Error
						? error.message
						: "Unable to generate export data.",
			})
		}
	}

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			<div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
						ANALYTICS
					</h1>
					<p className="mt-1 text-sm text-ds-muted">
						{"// "}
						{periodLabel.toUpperCase()}
					</p>
				</div>
				<div className="inline-flex items-center gap-2 border-[2px] border-ds-muted3 px-2 py-1">
					<CalendarDays className="h-3.5 w-3.5 text-ds-text-tertiary" />
					<span className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
						LIVE_ORG_INTELLIGENCE
					</span>
				</div>
			</div>

			<div className="mb-5 border-[3px] border-ds-muted3 p-3 sm:p-4">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="w-full sm:max-w-xs">
						<label
							htmlFor="team-scope-select"
							className="mb-2 block text-[10px] font-bold tracking-widest text-ds-text-tertiary"
						>
							TEAM_SCOPE
						</label>
						<select
							id="team-scope-select"
							value={selectedTeamId}
							onChange={(event) => setSelectedTeamId(event.target.value)}
							className="w-full border-[2px] border-ds-muted3 bg-ds-input-bg px-3 py-2 text-xs font-bold tracking-wide text-ds-fg outline-none transition-colors focus:border-ds-accent"
						>
							{teamOptions.map((teamOption) => (
								<option key={teamOption.id} value={teamOption.id}>
									{teamOption.name}
								</option>
							))}
						</select>
					</div>

					<div className="flex flex-wrap gap-2">
						{RANGE_OPTIONS.map((option) => {
							const isActive = rangeDays === option.value
							return (
								<button
									key={option.value}
									type="button"
									onClick={() => setRangeDays(option.value)}
									className={`border-[2px] px-3 py-1.5 text-[10px] font-extrabold tracking-widest transition-colors ${
										isActive
											? "border-ds-accent bg-ds-accent/10 text-ds-accent"
											: "border-ds-muted3 text-ds-text-tertiary hover:border-ds-accent hover:text-ds-accent"
									}`}
								>
									{option.label}
								</button>
							)
						})}
					</div>
				</div>
			</div>

			<div className="mb-5 border-[3px] border-ds-muted3 p-3 sm:p-4">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<FileDown className="h-4 w-4 text-ds-accent" />
						<span className="text-xs font-extrabold tracking-widest text-ds-accent">
							EXPORT_RANGE
						</span>
					</div>
					{analytics ? (
						<button
							type="button"
							onClick={() => {
								setExportStartDate(analytics.period.startDate)
								setExportEndDate(analytics.period.endDate)
								setExportTeamId(selectedTeamId)
							}}
							className="border-[2px] border-ds-muted3 px-2 py-1 text-[9px] font-extrabold tracking-widest text-ds-text-secondary transition-colors hover:border-ds-accent hover:text-ds-accent"
						>
							USE_CURRENT_WINDOW
						</button>
					) : null}
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-5">
					<select
						value={exportTeamId}
						onChange={(event) => setExportTeamId(event.target.value)}
						className="min-w-0 border-[2px] border-ds-muted3 bg-ds-input-bg px-3 py-2 text-xs font-bold tracking-wide text-ds-fg outline-none transition-colors focus:border-ds-accent"
					>
						{teamOptions.map((teamOption) => (
							<option key={teamOption.id} value={teamOption.id}>
								{teamOption.name}
							</option>
						))}
					</select>
					<input
						type="date"
						value={exportStartDate}
						onChange={(event) => setExportStartDate(event.target.value)}
						className="min-w-0 border-[2px] border-ds-muted3 bg-ds-input-bg px-3 py-2 text-xs font-bold tracking-wide text-ds-fg outline-none transition-colors focus:border-ds-accent"
					/>
					<input
						type="date"
						value={exportEndDate}
						onChange={(event) => setExportEndDate(event.target.value)}
						className="min-w-0 border-[2px] border-ds-muted3 bg-ds-input-bg px-3 py-2 text-xs font-bold tracking-wide text-ds-fg outline-none transition-colors focus:border-ds-accent"
					/>
					<button
						type="button"
						onClick={() => void handleExport("markdown")}
						disabled={exportMutation.isPending}
						className="border-[2px] border-ds-accent px-3 py-2 text-[10px] font-extrabold tracking-widest text-ds-accent transition-colors hover:bg-ds-accent hover:text-ds-accent-fg disabled:cursor-not-allowed disabled:opacity-50"
					>
						{exportMutation.isPending ? "EXPORTING..." : "EXPORT_MD"}
					</button>
					<button
						type="button"
						onClick={() => void handleExport("csv")}
						disabled={exportMutation.isPending}
						className="border-[2px] border-cyan-600 px-3 py-2 text-[10px] font-extrabold tracking-widest text-cyan-600 transition-colors hover:bg-cyan-600 hover:text-black dark:border-cyan-400 dark:text-cyan-400 dark:hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{exportMutation.isPending ? "EXPORTING..." : "EXPORT_CSV"}
					</button>
				</div>
				<p className="mt-2 text-xs text-ds-muted">
					Download scoped standup data as narrative markdown or raw CSV rows.
				</p>
			</div>

			{!hasSubmitted && (
				<div className="mb-5 flex flex-col gap-4 border-[3px] border-ds-accent bg-ds-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
					<div className="flex items-start gap-3 sm:items-center">
						<div className="flex h-9 w-9 items-center justify-center bg-ds-accent text-ds-accent-fg">
							<PenSquare className="h-4 w-4" />
						</div>
						<div>
							<div className="text-xs font-extrabold tracking-widest">STANDUP_PENDING</div>
							<p className="mt-1 text-xs text-ds-muted">
								Your update is missing for today.
							</p>
						</div>
					</div>
					<Link to="/app/standup" className="w-full sm:w-auto">
						<button
							type="button"
							className="flex w-full items-center justify-center gap-2 bg-ds-accent px-4 py-2 text-xs font-extrabold tracking-wider text-ds-accent-fg transition-colors hover:bg-ds-accent-hover sm:w-auto"
						>
							SUBMIT_STANDUP
							<ArrowRight className="h-3.5 w-3.5" />
						</button>
					</Link>
				</div>
			)}

			{analyticsQuery.isLoading || !analytics ? (
				<DashboardSkeleton />
			) : (
				<>
					<div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-[2px] border-ds-muted3 px-3 py-2">
						<div className="flex items-center gap-2">
							<span className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
								METRIC_TRACKING_MODEL
							</span>
							<InfoPopover title="How Tracking Works">
								<p className="text-xs text-ds-muted">
									Metrics are computed from raw standup entries in the selected
									date/team scope. Participation is active users divided by scoped
									member count.
								</p>
							</InfoPopover>
						</div>
						<button
							type="button"
							onClick={() => setActiveOverlay("metrics")}
							className="border-[2px] border-ds-muted3 px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-ds-text-secondary transition-colors hover:border-ds-accent hover:text-ds-accent"
						>
							OPEN_DATA_OVERLAY
						</button>
					</div>

					<div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
						<MetricTile
							label="TOTAL_ENTRIES"
							value={String(analytics.totals.entries)}
							icon={<Target className="h-3.5 w-3.5" />}
							tone="cyan"
						/>
						<MetricTile
							label="ACTIVE_USERS"
							value={`${analytics.totals.activeUsers}/${analytics.scope.members}`}
							icon={<UsersRound className="h-3.5 w-3.5" />}
							tone="neutral"
						/>
						<MetricTile
							label="PARTICIPATION"
							value={formatPercent(analytics.totals.participationRate)}
							icon={<Building2 className="h-3.5 w-3.5" />}
							tone="lime"
						/>
						<MetricTile
							label="BLOCKER_RATE"
							value={formatPercent(analytics.totals.blockerRate, 1)}
							icon={<TriangleAlert className="h-3.5 w-3.5" />}
							tone="red"
						/>
						<MetricTile
							label="ACTIVE_TEAMS"
							value={String(analytics.totals.activeTeams)}
							icon={<Building2 className="h-3.5 w-3.5" />}
							tone="neutral"
						/>
						<MetricTile
							label="COMPLETE/PLAN"
							value={formatPercent(completionToPlanRatio, 0)}
							icon={<CheckCircle2 className="h-3.5 w-3.5" />}
							tone="lime"
						/>
					</div>

					<div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
						<div className="xl:col-span-8">
							<DailyTrendPanel
								dailyTrend={analytics.dailyTrend}
								onOpenOverlay={() => setActiveOverlay("activity")}
							/>
						</div>
						<div className="xl:col-span-4">
							<InsightsPanel analytics={analytics} />
						</div>
					</div>

					<div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
						<div className="xl:col-span-7">
							<TeamPerformancePanel
								teamStats={analytics.teamStats}
								onOpenOverlay={() => setActiveOverlay("teams")}
							/>
						</div>
						<div className="space-y-4 xl:col-span-5">
							<ContributorPanel
								contributors={analytics.topContributors}
								onOpenOverlay={() => setActiveOverlay("contributors")}
							/>
							<KeywordPanel
								keywords={analytics.keywords}
								onOpenOverlay={() => setActiveOverlay("keywords")}
							/>
						</div>
					</div>

					{activeOverlay === "metrics" ? (
						<AnalyticsOverlay
							title="METRIC_DATA_DETAILS"
							subtitle="Formula references, scoped people, and recent task samples."
							onClose={() => setActiveOverlay(null)}
						>
							<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
								<DataMetricCard
									label="PARTICIPATION"
									value={formatPercent(analytics.totals.participationRate)}
									description={`activeUsers (${analytics.totals.activeUsers}) / scopeMembers (${analytics.scope.members})`}
								/>
								<DataMetricCard
									label="BLOCKER_RATE"
									value={formatPercent(analytics.totals.blockerRate, 1)}
									description={`blockers (${analytics.totals.blockers}) / entries (${analytics.totals.entries})`}
								/>
								<DataMetricCard
									label="COMPLETE/PLAN"
									value={formatPercent(completionToPlanRatio, 0)}
									description={`completed (${analytics.totals.completed}) / planned (${analytics.totals.planned})`}
								/>
								<DataMetricCard
									label="ACTIVE_TEAMS"
									value={String(analytics.totals.activeTeams)}
									description="Distinct teams with standup entries in scope."
								/>
							</div>

							<div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
								<div>
									<h3 className="mb-2 text-xs font-extrabold tracking-widest text-ds-text-secondary">
										PEOPLE_BEHIND_DATA
									</h3>
									<div className="space-y-2">
										{analytics.contributorDrilldown.slice(0, 10).map((person) => (
											<div
												key={person.userId}
												className="flex items-center justify-between border border-ds-muted3 px-2 py-1.5 text-xs"
											>
												<span className="font-bold text-ds-text-secondary">
													{person.name}
												</span>
												<span className="text-ds-text-tertiary">
													{person.entries} entries
												</span>
											</div>
										))}
									</div>
								</div>
								<div>
									<h3 className="mb-2 text-xs font-extrabold tracking-widest text-ds-text-secondary">
										RECENT_TASK_SAMPLES
									</h3>
									<div className="space-y-2">
										{recentTaskSamples.slice(0, 10).map((task, index) => (
											<TaskLine
												key={`${task.date}-${task.userId}-${index}`}
												date={task.date}
												userName={task.userName}
												type={task.type}
												content={task.content}
											/>
										))}
									</div>
								</div>
							</div>
						</AnalyticsOverlay>
					) : null}

					{activeOverlay === "activity" ? (
						<AnalyticsOverlay
							title="ACTIVITY_WAVE_DRILLDOWN"
							subtitle="Day-level people and task records behind each bar."
							onClose={() => setActiveOverlay(null)}
						>
							<div className="space-y-3">
								{[...analytics.dailyDrilldown].reverse().map((day) => (
									<div key={day.date} className="border-[2px] border-ds-muted3 p-3">
										<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
											<div className="text-xs font-extrabold tracking-widest text-ds-text-secondary">
												{formatDate(day.date).toUpperCase()} • {day.total} ENTRIES
											</div>
											<div className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
												{day.activeUsers} ACTIVE_USERS
											</div>
										</div>
										<div className="mb-2 flex flex-wrap gap-2 text-[10px] font-bold tracking-widest">
											<span className="text-lime-600 dark:text-lime-400">
												DONE {day.completed}
											</span>
											<span className="text-cyan-600 dark:text-cyan-400">
												PLAN {day.planned}
											</span>
											<span className="text-red-500 dark:text-red-400">
												BLOCK {day.blockers}
											</span>
										</div>
										<div className="mb-2 text-[10px] font-bold tracking-widest text-ds-text-tertiary">
											TOP_PEOPLE:{" "}
											{day.topContributors.length > 0
												? day.topContributors
														.slice(0, 5)
														.map((person) => person.name)
														.join(", ")
												: "NONE"}
										</div>
										<div className="space-y-1.5">
											{day.sampleTasks.slice(0, 5).map((task, index) => (
												<TaskLine
													key={`${day.date}-${task.userId}-${index}`}
													date={day.date}
													userName={task.userName}
													type={task.type}
													content={task.content}
												/>
											))}
										</div>
									</div>
								))}
							</div>
						</AnalyticsOverlay>
					) : null}

					{activeOverlay === "teams" ? (
						<AnalyticsOverlay
							title="TEAM_DRILLDOWN"
							subtitle="Team metrics with associated contributors and sampled tasks."
							onClose={() => setActiveOverlay(null)}
						>
							<div className="space-y-3">
								{analytics.teamDrilldown.map((team) => (
									<div
										key={`${team.teamId ?? "global"}-${team.teamName}`}
										className="border-[2px] border-ds-muted3 p-3"
									>
										<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
											<div className="text-xs font-extrabold tracking-widest text-ds-text-secondary">
												{team.teamName.toUpperCase()}
											</div>
											<div className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
												{team.entries} ENTRIES
											</div>
										</div>
										<div className="mb-2 grid grid-cols-2 gap-2 text-[10px] font-bold tracking-widest">
											<span>PARTICIPATION {formatPercent(team.participationRate)}</span>
											<span>BLOCKER_RATE {formatPercent(team.blockerRate, 1)}</span>
										</div>
										<div className="mb-2 text-[10px] font-bold tracking-widest text-ds-text-tertiary">
											TOP_PEOPLE:{" "}
											{team.topContributors.length > 0
												? team.topContributors
														.slice(0, 5)
														.map((person) => person.name)
														.join(", ")
												: "NONE"}
										</div>
										<div className="space-y-1.5">
											{team.sampleTasks.slice(0, 5).map((task, index) => (
												<TaskLine
													key={`${team.teamName}-${task.userId}-${index}`}
													date={task.date}
													userName={task.userName}
													type={task.type}
													content={task.content}
												/>
											))}
										</div>
									</div>
								))}
							</div>
						</AnalyticsOverlay>
					) : null}

					{activeOverlay === "contributors" ? (
						<AnalyticsOverlay
							title="CONTRIBUTOR_DRILLDOWN"
							subtitle="Who contributed and exactly what tasks were tracked."
							onClose={() => setActiveOverlay(null)}
						>
							<div className="space-y-3">
								{analytics.contributorDrilldown.map((person) => (
									<div key={person.userId} className="border-[2px] border-ds-muted3 p-3">
										<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
											<div className="text-xs font-extrabold tracking-widest text-ds-text-secondary">
												{person.name.toUpperCase()}
											</div>
											<div className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
												{person.entries} ENTRIES • {person.daysPosted} DAYS
											</div>
										</div>
										<div className="mb-2 flex flex-wrap gap-2 text-[10px] font-bold tracking-widest">
											<span className="text-lime-600 dark:text-lime-400">
												DONE {person.completed}
											</span>
											<span className="text-cyan-600 dark:text-cyan-400">
												PLAN {person.planned}
											</span>
											<span className="text-red-500 dark:text-red-400">
												BLOCK {person.blockers}
											</span>
										</div>
										<div className="space-y-1.5">
											{person.sampleTasks.slice(0, 6).map((task, index) => (
												<TaskLine
													key={`${person.userId}-${task.date}-${index}`}
													date={task.date}
													userName={person.name}
													type={task.type}
													content={`${task.content} (${task.teamName})`}
												/>
											))}
										</div>
									</div>
								))}
							</div>
						</AnalyticsOverlay>
					) : null}

					{activeOverlay === "keywords" ? (
						<AnalyticsOverlay
							title="KEYWORD_DRILLDOWN"
							subtitle="Keyword frequencies with associated people and task excerpts."
							onClose={() => setActiveOverlay(null)}
						>
							<div className="space-y-3">
								{analytics.keywordDrilldown.map((keyword) => (
									<div key={keyword.term} className="border-[2px] border-ds-muted3 p-3">
										<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
											<div className="text-xs font-extrabold tracking-widest text-ds-text-secondary">
												{keyword.term.toUpperCase()}
											</div>
											<div className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
												{keyword.count} MENTIONS • {keyword.uniquePeople} PEOPLE
											</div>
										</div>
										<div className="space-y-1.5">
											{keyword.samples.slice(0, 5).map((sample, index) => (
												<TaskLine
													key={`${keyword.term}-${sample.userId}-${index}`}
													date={sample.date}
													userName={sample.userName}
													type={sample.type}
													content={sample.content}
												/>
											))}
										</div>
									</div>
								))}
							</div>
						</AnalyticsOverlay>
					) : null}
				</>
			)}
		</div>
	)
}

function DashboardSkeleton() {
	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
				{["a", "b", "c", "d", "e", "f"].map((slot) => (
					<div
						key={slot}
						className="h-20 animate-pulse border-[3px] border-ds-muted3 bg-ds-surface/20"
					/>
				))}
			</div>
			<div className="h-64 animate-pulse border-[3px] border-ds-muted3 bg-ds-surface/20" />
			<div className="h-72 animate-pulse border-[3px] border-ds-muted3 bg-ds-surface/20" />
		</div>
	)
}

function InfoPopover({
	title,
	children,
}: {
	title: string
	children: ReactNode
}) {
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		if (!open) return
		const onPointerDown = (event: PointerEvent) => {
			if (!rootRef.current) return
			const target = event.target
			if (target instanceof Node && !rootRef.current.contains(target)) {
				setOpen(false)
			}
		}
		window.addEventListener("pointerdown", onPointerDown)
		return () => window.removeEventListener("pointerdown", onPointerDown)
	}, [open])

	return (
		<div ref={rootRef} className="relative flex shrink-0 items-center">
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				aria-label={title}
				className="inline-grid h-[18px] w-[18px] place-items-center border-[2px] border-ds-muted3 text-[10px] font-extrabold leading-none text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
			>
				<span className="-translate-y-px">?</span>
			</button>
			{open ? (
				<div className="absolute right-0 top-6 z-30 w-72 border-[2px] border-ds-muted3 bg-ds-surface p-3 shadow-xl">
					<div className="mb-1 text-[10px] font-extrabold tracking-widest text-ds-text-secondary">
						{title.toUpperCase()}
					</div>
					{children}
				</div>
			) : null}
		</div>
	)
}

function AnalyticsOverlay({
	title,
	subtitle,
	onClose,
	children,
}: {
	title: string
	subtitle: string
	onClose: () => void
	children: ReactNode
}) {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose()
		}
		window.addEventListener("keydown", onKeyDown)
		return () => window.removeEventListener("keydown", onKeyDown)
	}, [onClose])

	return (
		<div className="fixed inset-0 z-50 bg-black/65 p-4 backdrop-blur-sm">
			<div className="mx-auto flex h-full w-full max-w-[1100px] flex-col border-[3px] border-ds-muted3 bg-ds-bg">
				<div className="flex items-center justify-between border-b-[2px] border-ds-muted3 px-4 py-3">
					<div>
						<h2 className="text-sm font-extrabold tracking-widest">{title}</h2>
						<p className="mt-1 text-xs text-ds-muted">{subtitle}</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="border-[2px] border-ds-muted3 px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-ds-text-secondary transition-colors hover:border-red-500 hover:text-red-500"
					>
						CLOSE
					</button>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
			</div>
		</div>
	)
}

function DataMetricCard({
	label,
	value,
	description,
}: {
	label: string
	value: string
	description: string
}) {
	return (
		<div className="border-[2px] border-ds-muted3 p-3">
			<p className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
				{label}
			</p>
			<p className="mt-1 text-base font-extrabold">{value}</p>
			<p className="mt-1 text-xs text-ds-muted">{description}</p>
		</div>
	)
}

function TaskLine({
	date,
	userName,
	type,
	content,
}: {
	date: string
	userName: string
	type: "completed" | "planned" | "blocker"
	content: string
}) {
	const toneClass =
		type === "completed"
			? "text-lime-600 dark:text-lime-400"
			: type === "planned"
				? "text-cyan-600 dark:text-cyan-400"
				: "text-red-500 dark:text-red-400"

	return (
		<div className="border border-ds-muted3 px-2 py-1.5 text-xs">
			<div className="mb-1 flex items-center justify-between gap-2">
				<span className={`text-[10px] font-extrabold tracking-widest ${toneClass}`}>
					{type.toUpperCase()}
				</span>
				<span className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
					{formatDate(date).toUpperCase()}
				</span>
			</div>
			<div className="font-bold text-ds-text-secondary">{userName}</div>
			<div className="mt-0.5 text-ds-muted">{content}</div>
		</div>
	)
}

function MetricTile({
	label,
	value,
	icon,
	tone,
}: {
	label: string
	value: string
	icon: ReactNode
	tone: "lime" | "cyan" | "red" | "neutral"
}) {
	const toneClass =
		tone === "lime"
			? "text-lime-600 dark:text-lime-400"
			: tone === "cyan"
				? "text-cyan-600 dark:text-cyan-400"
				: tone === "red"
					? "text-red-500 dark:text-red-400"
					: "text-ds-text-secondary"

	return (
		<div className="border-[3px] border-ds-muted3 px-3 py-2.5">
			<div className="mb-1 flex items-center justify-between">
				<span className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
					{label}
				</span>
				<span className={toneClass}>{icon}</span>
			</div>
			<div className="text-lg font-extrabold tracking-tight">{value}</div>
		</div>
	)
}

function DailyTrendPanel({
	dailyTrend,
	onOpenOverlay,
}: {
	dailyTrend: AnalyticsResponse["dailyTrend"]
	onOpenOverlay: () => void
}) {
	const maxTotal = Math.max(...dailyTrend.map((day) => day.total), 1)

	return (
		<div className="border-[3px] border-ds-muted3 p-4 sm:p-5">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<h2 className="text-sm font-extrabold tracking-widest">ACTIVITY_WAVE</h2>
						<InfoPopover title="Activity Wave Tracking">
							<p className="text-xs text-ds-muted">
								Each bar stacks completed, planned, and blocker entry counts for a
								day. Heights are normalized to the max total in the visible window.
							</p>
						</InfoPopover>
					</div>
					<p className="mt-1 text-xs text-ds-text-tertiary">
						Daily standup volume split by completed, planned, blockers.
					</p>
				</div>
				<div className="flex items-center gap-3 text-[10px] font-bold tracking-widest">
					<span className="flex items-center gap-1 text-lime-600 dark:text-lime-400">
						<span className="h-2 w-2 bg-lime-500 dark:bg-lime-400" />DONE
					</span>
					<span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
						<span className="h-2 w-2 bg-cyan-500 dark:bg-cyan-400" />PLAN
					</span>
					<span className="flex items-center gap-1 text-red-500 dark:text-red-400">
						<span className="h-2 w-2 bg-red-500 dark:bg-red-400" />BLOCK
					</span>
					<button
						type="button"
						onClick={onOpenOverlay}
						className="border-[2px] border-ds-muted3 px-2 py-1 text-[9px] font-extrabold tracking-widest text-ds-text-secondary transition-colors hover:border-ds-accent hover:text-ds-accent"
					>
						DETAILS
					</button>
				</div>
			</div>

			<div className="overflow-x-auto pb-2">
				<div className="flex min-w-max items-end gap-2">
					{dailyTrend.map((day) => {
						const completedHeight = (day.completed / maxTotal) * 100
						const plannedHeight = (day.planned / maxTotal) * 100
						const blockerHeight = (day.blockers / maxTotal) * 100
						const date = new Date(`${day.date}T12:00:00`)
						const weekday = date
							.toLocaleDateString("en-US", { weekday: "short" })
							.toUpperCase()
						const dayNum = date.getDate()

						return (
							<div key={day.date} className="flex w-7 flex-col items-center gap-1">
								<div
									title={`${day.date} | total ${day.total} | active users ${day.activeUsers}`}
									className="flex h-40 w-full flex-col justify-end border-[2px] border-ds-muted3 bg-ds-surface/20"
								>
									<div
										className="bg-red-500/85 dark:bg-red-400/85"
										style={{ height: `${blockerHeight}%` }}
									/>
									<div
										className="bg-cyan-500/85 dark:bg-cyan-400/85"
										style={{ height: `${plannedHeight}%` }}
									/>
									<div
										className="bg-lime-500/85 dark:bg-lime-400/85"
										style={{ height: `${completedHeight}%` }}
									/>
								</div>
								<span className="text-[9px] font-bold tracking-widest text-ds-text-tertiary">
									{weekday.slice(0, 1)}
								</span>
								<span className="text-[10px] font-bold text-ds-text-secondary">
									{dayNum}
								</span>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}

function InsightsPanel({ analytics }: { analytics: AnalyticsResponse }) {
	const topHotspot = analytics.blockerHotspots[0]
	const topKeyword = analytics.keywords[0]

	return (
		<div className="border-[3px] border-ds-muted3 p-4 sm:p-5">
			<div className="flex items-center gap-2">
				<h2 className="text-sm font-extrabold tracking-widest">INSIGHTS</h2>
				<InfoPopover title="Insights Tracking">
					<p className="text-xs text-ds-muted">
						Completion and blocker trends compare the last up-to-7 days with the
						previous window. Hotspots and keywords come from current scope entries.
					</p>
				</InfoPopover>
			</div>
			<div className="mt-4 space-y-3">
				<InsightRow
					label="COMPLETION_TREND"
					value={formatDelta(analytics.insights.completionDelta)}
					icon={
						analytics.insights.completionDelta >= 0 ? (
							<TrendingUp className="h-3.5 w-3.5" />
						) : (
							<TrendingDown className="h-3.5 w-3.5" />
						)
					}
					tone={analytics.insights.completionDelta >= 0 ? "lime" : "red"}
				/>
				<InsightRow
					label="BLOCKER_TREND"
					value={formatDelta(analytics.insights.blockerDelta)}
					icon={<TriangleAlert className="h-3.5 w-3.5" />}
					tone={analytics.insights.blockerDelta > 0 ? "red" : "lime"}
				/>
				<InsightRow
					label="TOP_HOTSPOT"
					value={topHotspot ? topHotspot.teamName.toUpperCase() : "NONE"}
					icon={<Building2 className="h-3.5 w-3.5" />}
					tone={topHotspot ? "red" : "neutral"}
				/>
				<InsightRow
					label="TOP_KEYWORD"
					value={topKeyword ? `${topKeyword.term.toUpperCase()} (${topKeyword.count})` : "N/A"}
					icon={<Target className="h-3.5 w-3.5" />}
					tone={topKeyword ? "cyan" : "neutral"}
				/>
			</div>

			{analytics.blockerHotspots.length > 0 && (
				<div className="mt-5 border-t-[2px] border-ds-muted3 pt-4">
					<p className="mb-2 text-[10px] font-bold tracking-widest text-ds-text-tertiary">
						BLOCKER_HOTSPOTS
					</p>
					<div className="space-y-2">
						{analytics.blockerHotspots.slice(0, 4).map((team) => (
							<div key={team.teamName}>
								<div className="mb-1 flex items-center justify-between text-[11px]">
									<span className="font-bold text-ds-text-secondary">
										{team.teamName}
									</span>
									<span className="font-bold text-red-500 dark:text-red-400">
										{formatPercent(team.blockerRate, 1)}
									</span>
								</div>
								<div className="h-1.5 bg-ds-surface2">
									<div
										className="h-full bg-red-500/85 dark:bg-red-400/85"
										style={{ width: `${Math.min(100, team.blockerRate * 100)}%` }}
									/>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

function InsightRow({
	label,
	value,
	icon,
	tone,
}: {
	label: string
	value: string
	icon: ReactNode
	tone: "lime" | "cyan" | "red" | "neutral"
}) {
	const toneClass =
		tone === "lime"
			? "text-lime-600 dark:text-lime-400"
			: tone === "cyan"
				? "text-cyan-600 dark:text-cyan-400"
				: tone === "red"
					? "text-red-500 dark:text-red-400"
					: "text-ds-text-secondary"

	return (
		<div className="flex items-center justify-between border-[2px] border-ds-muted3 px-2.5 py-2">
			<div>
				<p className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
					{label}
				</p>
				<p className={`mt-1 text-xs font-extrabold ${toneClass}`}>{value}</p>
			</div>
			<span className={toneClass}>{icon}</span>
		</div>
	)
}

function TeamPerformancePanel({
	teamStats,
	onOpenOverlay,
}: {
	teamStats: AnalyticsResponse["teamStats"]
	onOpenOverlay: () => void
}) {
	return (
		<div className="border-[3px] border-ds-muted3 p-4 sm:p-5">
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h2 className="text-sm font-extrabold tracking-widest">TEAM_PERFORMANCE</h2>
					<InfoPopover title="Team Performance Tracking">
						<p className="text-xs text-ds-muted">
							Team metrics are aggregated from standup entries per team in the
							selected date range. Participation uses active users divided by team
							member count.
						</p>
					</InfoPopover>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
						{teamStats.length} ACTIVE
					</span>
					<button
						type="button"
						onClick={onOpenOverlay}
						className="border-[2px] border-ds-muted3 px-2 py-1 text-[9px] font-extrabold tracking-widest text-ds-text-secondary transition-colors hover:border-ds-accent hover:text-ds-accent"
					>
						DETAILS
					</button>
				</div>
			</div>
			<div className="space-y-2">
				{teamStats.slice(0, 10).map((team) => (
					<div key={`${team.teamId ?? "global"}-${team.teamName}`} className="border-[2px] border-ds-muted3 p-2.5">
						<div className="mb-2 flex items-center justify-between">
							<span className="text-xs font-extrabold tracking-wide text-ds-text-secondary">
								{team.teamName.toUpperCase()}
							</span>
							<span className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
								{team.entries} ENTRIES
							</span>
						</div>
						<div className="grid grid-cols-3 gap-2 text-[10px] font-bold tracking-widest">
							<span className="text-lime-600 dark:text-lime-400">DONE {team.completed}</span>
							<span className="text-cyan-600 dark:text-cyan-400">PLAN {team.planned}</span>
							<span className="text-red-500 dark:text-red-400">BLOCK {team.blockers}</span>
						</div>
						<div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
							<div>
								<div className="mb-1 flex justify-between font-bold text-ds-text-tertiary">
									<span>PARTICIPATION</span>
									<span>{formatPercent(team.participationRate)}</span>
								</div>
								<div className="h-1.5 bg-ds-surface2">
									<div
										className="h-full bg-ds-accent"
										style={{ width: `${Math.min(100, team.participationRate * 100)}%` }}
									/>
								</div>
							</div>
							<div>
								<div className="mb-1 flex justify-between font-bold text-ds-text-tertiary">
									<span>BLOCKER_RATE</span>
									<span>{formatPercent(team.blockerRate, 1)}</span>
								</div>
								<div className="h-1.5 bg-ds-surface2">
									<div
										className="h-full bg-red-500/85 dark:bg-red-400/85"
										style={{ width: `${Math.min(100, team.blockerRate * 100)}%` }}
									/>
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function ContributorPanel({
	contributors,
	onOpenOverlay,
}: {
	contributors: AnalyticsResponse["topContributors"]
	onOpenOverlay: () => void
}) {
	return (
		<div className="border-[3px] border-ds-muted3 p-4 sm:p-5">
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h2 className="text-sm font-extrabold tracking-widest">TOP_CONTRIBUTORS</h2>
					<InfoPopover title="Contributor Tracking">
						<p className="text-xs text-ds-muted">
							Ranking is based on total entries in the selected scope. Days posted,
							team coverage, and task records are available in details.
						</p>
					</InfoPopover>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
						{contributors.length} LISTED
					</span>
					<button
						type="button"
						onClick={onOpenOverlay}
						className="border-[2px] border-ds-muted3 px-2 py-1 text-[9px] font-extrabold tracking-widest text-ds-text-secondary transition-colors hover:border-ds-accent hover:text-ds-accent"
					>
						DETAILS
					</button>
				</div>
			</div>
			<div className="space-y-2">
				{contributors.slice(0, 10).map((contributor, index) => (
					<div
						key={contributor.userId}
						className="flex items-center justify-between border-[2px] border-ds-muted3 px-2.5 py-2"
					>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<span className="text-[10px] font-bold text-ds-text-tertiary">
									#{index + 1}
								</span>
								<span className="truncate text-xs font-bold text-ds-text-secondary">
									{contributor.name.toUpperCase()}
								</span>
							</div>
							<p className="mt-1 text-[10px] font-bold tracking-widest text-ds-text-tertiary">
								{contributor.daysPosted} DAYS • {contributor.teams} TEAMS
							</p>
						</div>
						<div className="text-right">
							<p className="text-sm font-extrabold">{contributor.entries}</p>
							<p className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
								ENTRIES
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function KeywordPanel({
	keywords,
	onOpenOverlay,
}: {
	keywords: AnalyticsResponse["keywords"]
	onOpenOverlay: () => void
}) {
	return (
		<div className="border-[3px] border-ds-muted3 p-4 sm:p-5">
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h2 className="text-sm font-extrabold tracking-widest">TOPICS</h2>
					<InfoPopover title="Keyword Tracking">
						<p className="text-xs text-ds-muted">
							Keywords are extracted from standup text after URL removal and
							stop-word filtering. Counts represent mention frequency in scope.
						</p>
					</InfoPopover>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
						AUTO_EXTRACTED
					</span>
					<button
						type="button"
						onClick={onOpenOverlay}
						className="border-[2px] border-ds-muted3 px-2 py-1 text-[9px] font-extrabold tracking-widest text-ds-text-secondary transition-colors hover:border-ds-accent hover:text-ds-accent"
					>
						DETAILS
					</button>
				</div>
			</div>
			<div className="flex flex-wrap gap-2">
				{keywords.length > 0 ? (
					keywords.slice(0, 14).map((keyword) => (
						<span
							key={keyword.term}
							className="border-[2px] border-ds-muted3 px-2 py-1 text-[10px] font-bold tracking-wide text-ds-text-secondary"
						>
							{keyword.term.toUpperCase()} ({keyword.count})
						</span>
					))
				) : (
					<span className="text-xs text-ds-muted">No repeated keyword patterns yet.</span>
				)}
			</div>
		</div>
	)
}
