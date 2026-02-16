import { createFileRoute } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { useQuery } from "@tanstack/react-query"
import { useState, useMemo } from "react"
import {
	CheckCircle2,
	Target,
	AlertTriangle,
	Users,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
} from "lucide-react"

export const Route = createFileRoute("/app/team/$teamId")({
	component: TeamView,
})

const PAGE_SIZE = 5 // days per page

function formatDateHeading(dateStr: string): string {
	const date = new Date(dateStr + "T12:00:00")
	const today = new Date()
	const yesterday = new Date()
	yesterday.setDate(today.getDate() - 1)

	const todayStr = today.toISOString().split("T")[0]
	const yesterdayStr = yesterday.toISOString().split("T")[0]

	if (dateStr === todayStr) return "TODAY"
	if (dateStr === yesterdayStr) return "YESTERDAY"

	return date
		.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		})
		.toUpperCase()
}

function formatDateSub(dateStr: string): string {
	const date = new Date(dateStr + "T12:00:00")
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	})
}

function getDateRange(page: number): { startDate: string; endDate: string } {
	const end = new Date()
	end.setDate(end.getDate() - page * PAGE_SIZE)
	const start = new Date(end)
	start.setDate(start.getDate() - (PAGE_SIZE - 1))

	return {
		startDate: start.toISOString().split("T")[0],
		endDate: end.toISOString().split("T")[0],
	}
}

function TeamView() {
	const { teamId } = Route.useParams()
	const trpc = useTRPC()
	const [page, setPage] = useState(0)

	const { startDate, endDate } = useMemo(() => getDateRange(page), [page])

	const { data: teams } = useQuery(trpc.teams.list.queryOptions())
	const { data: timelineData, isLoading } = useQuery(
		trpc.standups.getByDateRange.queryOptions({
			startDate,
			endDate,
			teamId,
		}),
	)
	const { data: members } = useQuery(
		trpc.teams.getMembers.queryOptions({ teamId }),
	)

	const team = teams?.find((t) => t.id === teamId)

	// Build all dates in range (so empty days show too)
	const allDates = useMemo(() => {
		const dates: string[] = []
		const cur = new Date(endDate + "T12:00:00")
		const stop = new Date(startDate + "T12:00:00")
		while (cur >= stop) {
			dates.push(cur.toISOString().split("T")[0])
			cur.setDate(cur.getDate() - 1)
		}
		return dates
	}, [startDate, endDate])

	const dataByDate = useMemo(() => {
		const map = new Map<
			string,
			{
				user: { id: string; name: string; image: string | null }
				completed: string[]
				planned: string[]
				blockers: string[]
			}[]
		>()
		if (timelineData) {
			for (const day of timelineData) {
				map.set(day.date, day.standups)
			}
		}
		return map
	}, [timelineData])

	return (
		<div className="p-6 max-w-4xl">
			{/* Header */}
			<div className="flex items-center gap-3 mb-8">
				<div className="w-10 h-10 bg-ds-accent text-ds-accent-fg flex items-center justify-center">
					<Users className="w-5 h-5" />
				</div>
				<div>
					<h1 className="text-3xl font-extrabold tracking-tighter">
						{team?.name?.toUpperCase() ?? "TEAM"}
					</h1>
					<p className="text-ds-muted text-sm">
						// {members?.length ?? 0} MEMBERS
					</p>
				</div>
			</div>

			{/* Pagination Controls */}
			<div className="flex items-center justify-between mb-6 border-[3px] border-ds-border p-3">
				<button
					type="button"
					onClick={() => setPage((p) => p + 1)}
					className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-ds-text-tertiary hover:text-ds-fg transition-colors px-2 py-1"
				>
					<ChevronLeft className="w-4 h-4" />
					OLDER
				</button>

				<div className="text-center">
					<span className="text-xs font-bold tracking-widest text-ds-muted">
						{new Date(startDate + "T12:00:00")
							.toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
							})
							.toUpperCase()}{" "}
						&mdash;{" "}
						{new Date(endDate + "T12:00:00")
							.toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
							})
							.toUpperCase()}
					</span>
				</div>

				<div className="flex items-center gap-1">
					{page > 0 && (
						<button
							type="button"
							onClick={() => setPage(0)}
							className="flex items-center gap-1 text-xs font-bold tracking-wider text-ds-text-tertiary hover:text-ds-accent transition-colors px-2 py-1"
							title="Jump to today"
						>
							<ChevronsLeft className="w-4 h-4 rotate-180" />
							TODAY
						</button>
					)}
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(0, p - 1))}
						disabled={page === 0}
						className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-ds-text-tertiary hover:text-ds-fg transition-colors px-2 py-1 disabled:opacity-25 disabled:cursor-not-allowed"
					>
						NEWER
						<ChevronRight className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Timeline */}
			{isLoading ? (
				<div className="space-y-6">
					{[1, 2, 3].map((i) => (
						<div key={i}>
							<div className="h-4 w-32 bg-ds-surface2 animate-pulse mb-3" />
							<div className="border-[3px] border-ds-border p-6 h-28 animate-pulse" />
						</div>
					))}
				</div>
			) : (
				<div className="space-y-0">
					{allDates.map((date) => {
						const standups = dataByDate.get(date)
						return (
							<DaySection
								key={date}
								date={date}
								standups={standups ?? []}
							/>
						)
					})}
				</div>
			)}

			{/* Keyboard hint */}
			<div className="mt-6 text-center text-[10px] text-ds-muted3 font-bold tracking-widest">
				// SHOWING {PAGE_SIZE} DAYS PER PAGE
			</div>
		</div>
	)
}

function DaySection({
	date,
	standups,
}: {
	date: string
	standups: {
		user: { id: string; name: string; image: string | null }
		completed: string[]
		planned: string[]
		blockers: string[]
	}[]
}) {
	const isToday = date === new Date().toISOString().split("T")[0]
	const hasStandups = standups.length > 0
	const isWeekend = (() => {
		const d = new Date(date + "T12:00:00").getDay()
		return d === 0 || d === 6
	})()

	return (
		<div className="border-[3px] border-ds-border -mt-[3px]">
			{/* Day header */}
			<div
				className={`flex items-center justify-between px-5 py-3 border-b-[3px] border-ds-border ${isToday ? "bg-ds-accent/5" : ""}`}
			>
				<div className="flex items-center gap-3">
					{isToday && (
						<span className="w-2 h-2 bg-ds-accent rounded-full animate-pulse" />
					)}
					<span
						className={`text-sm font-extrabold tracking-wider ${isToday ? "text-ds-accent" : "text-ds-fg"}`}
					>
						{formatDateHeading(date)}
					</span>
					<span className="text-xs text-ds-muted2">{formatDateSub(date)}</span>
				</div>
				<span className="text-xs font-bold text-ds-muted2 tracking-wider">
					{hasStandups
						? `${standups.length} ${standups.length === 1 ? "UPDATE" : "UPDATES"}`
						: isWeekend
							? "WEEKEND"
							: "NO_UPDATES"}
				</span>
			</div>

			{/* Standups for this day */}
			{hasStandups ? (
				<div>
					{standups.map((standup) => (
						<div
							key={standup.user.id}
							className="px-5 py-4 border-b-[2px] border-ds-border/60 last:border-b-0"
						>
							<div className="flex items-center gap-3 mb-4">
								<div className="w-7 h-7 bg-ds-accent text-ds-accent-fg flex items-center justify-center font-extrabold text-[10px]">
									{standup.user.name
										.split(" ")
										.map((n) => n[0])
										.join("")
										.toUpperCase()}
								</div>
								<span className="font-bold text-sm tracking-wider">
									{standup.user.name.toUpperCase()}
								</span>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-10">
								{standup.completed.length > 0 && (
									<EntryColumn
										icon={<CheckCircle2 className="w-3 h-3" />}
										label="DONE"
										color="lime"
										items={standup.completed}
									/>
								)}
								{standup.planned.length > 0 && (
									<EntryColumn
										icon={<Target className="w-3 h-3" />}
										label="NEXT"
										color="cyan"
										items={standup.planned}
									/>
								)}
								{standup.blockers.length > 0 && (
									<EntryColumn
										icon={<AlertTriangle className="w-3 h-3" />}
										label="BLOCKED"
										color="red"
										items={standup.blockers}
									/>
								)}
							</div>
						</div>
					))}
				</div>
			) : (
				<div
					className={`px-5 py-3 text-xs ${isWeekend ? "text-ds-muted3" : "text-ds-muted2"}`}
				>
					{isWeekend
						? "// weekend — no standups expected"
						: "// no submissions for this day"}
				</div>
			)}
		</div>
	)
}

const colorMap = {
	lime: {
		border: "border-l-lime-600 dark:border-l-lime-400",
		bg: "bg-lime-500/5 dark:bg-lime-400/5",
		text: "text-lime-600 dark:text-lime-400",
	},
	cyan: {
		border: "border-l-cyan-600 dark:border-l-cyan-400",
		bg: "bg-cyan-500/5 dark:bg-cyan-400/5",
		text: "text-cyan-600 dark:text-cyan-400",
	},
	red: {
		border: "border-l-red-500 dark:border-l-red-400",
		bg: "bg-red-500/5 dark:bg-red-400/5",
		text: "text-red-500 dark:text-red-400",
	},
} as const

function EntryColumn({
	icon,
	label,
	color,
	items,
}: {
	icon: React.ReactNode
	label: string
	color: "lime" | "cyan" | "red"
	items: string[]
}) {
	const c = colorMap[color]

	return (
		<div>
			<div className="flex items-center gap-1.5 mb-2">
				<span className={c.text}>{icon}</span>
				<span
					className={`text-[10px] font-extrabold tracking-widest ${c.text}`}
				>
					{label}
				</span>
				<span className="text-[10px] text-ds-muted3 font-bold">{items.length}</span>
			</div>
			<div className="space-y-1.5">
				{items.map((item, i) => (
					<div
						key={i}
						className={`border-l-[2px] ${c.border} ${c.bg} px-2.5 py-1.5`}
					>
						<span className="text-xs text-ds-text-secondary leading-relaxed">
							{item}
						</span>
					</div>
				))}
			</div>
		</div>
	)
}
