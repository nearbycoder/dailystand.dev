import { createFileRoute } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, Target, AlertTriangle } from "lucide-react"

export const Route = createFileRoute("/app/history")({
	component: HistoryPage,
})

function HistoryPage() {
	const trpc = useTRPC()
	const { data: history, isLoading } = useQuery(
		trpc.standups.getMine.queryOptions({ limit: 30 }),
	)

	return (
		<div className="p-6 max-w-4xl">
			<div className="mb-8">
				<h1 className="text-3xl font-extrabold tracking-tighter">HISTORY</h1>
				<p className="text-ds-muted text-sm mt-1">
					// YOUR RECENT STANDUPS
				</p>
			</div>

			{isLoading ? (
				<div className="space-y-6">
					{[1, 2, 3].map((i) => (
						<div key={i}>
							<div className="h-4 w-32 bg-ds-surface2 animate-pulse mb-3" />
							<div className="border-[3px] border-ds-border p-6 h-28 animate-pulse" />
						</div>
					))}
				</div>
			) : history && history.length > 0 ? (
				<div className="space-y-0">
					{history.map((entry) => {
						const date = new Date(entry.date + "T12:00:00")
						const heading = formatDateHeading(entry.date)
						const sub = date.toLocaleDateString("en-US", {
							weekday: "long",
							year: "numeric",
							month: "long",
							day: "numeric",
						})
						const isToday =
							entry.date === new Date().toISOString().split("T")[0]
						const count =
							entry.completed.length +
							entry.planned.length +
							entry.blockers.length

						return (
							<div
								key={entry.date}
								className="border-[3px] border-ds-border -mt-[3px]"
							>
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
											{heading}
										</span>
										<span className="text-xs text-ds-muted2">{sub}</span>
									</div>
									<span className="text-xs font-bold text-ds-muted2 tracking-wider">
										{count} {count === 1 ? "ITEM" : "ITEMS"}
									</span>
								</div>

								{/* Content */}
								<div className="px-5 py-4">
									<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
										{entry.completed.length > 0 && (
											<EntryColumn
												icon={<CheckCircle2 className="w-3 h-3" />}
												label="DONE"
												color="lime"
												items={entry.completed}
											/>
										)}
										{entry.planned.length > 0 && (
											<EntryColumn
												icon={<Target className="w-3 h-3" />}
												label="NEXT"
												color="cyan"
												items={entry.planned}
											/>
										)}
										{entry.blockers.length > 0 && (
											<EntryColumn
												icon={<AlertTriangle className="w-3 h-3" />}
												label="BLOCKED"
												color="red"
												items={entry.blockers}
											/>
										)}
									</div>
								</div>
							</div>
						)
					})}
				</div>
			) : (
				<div className="border-[3px] border-ds-border p-12 text-center">
					<p className="text-ds-muted text-sm">
						NO_HISTORY // Submit your first standup.
					</p>
				</div>
			)}
		</div>
	)
}

function formatDateHeading(dateStr: string): string {
	const date = new Date(dateStr + "T12:00:00")
	const today = new Date()
	const yesterday = new Date()
	yesterday.setDate(today.getDate() - 1)

	if (dateStr === today.toISOString().split("T")[0]) return "TODAY"
	if (dateStr === yesterday.toISOString().split("T")[0]) return "YESTERDAY"

	return date
		.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		})
		.toUpperCase()
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
				<span className="text-[10px] text-ds-muted3 font-bold">
					{items.length}
				</span>
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
