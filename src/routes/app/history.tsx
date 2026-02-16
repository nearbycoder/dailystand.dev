import { createFileRoute } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AutoLinkText } from "@/components/auto-link-text"
import { useState } from "react"
import type { ReactNode } from "react"
import {
	CheckCircle2,
	Target,
	AlertTriangle,
	Copy,
	Check,
	Link2,
	Link2Off,
} from "lucide-react"

export const Route = createFileRoute("/app/history")({
	component: HistoryPage,
})

type HistoryEntry = {
	date: string
	sharedToken: string | null
	completed: string[]
	planned: string[]
	blockers: string[]
}

type DayActionState =
	| "idle"
	| "copied"
	| "error"
	| "sharing"
	| "retracting"

function buildShareUrl(token: string) {
	if (typeof window === "undefined") return `/share/${token}`
	return `${window.location.origin}/share/${token}`
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

function getSectionMarkdown(label: string, items: string[]): string[] {
	if (items.length === 0) return []
	return [label, ...items.map((item) => `- ${item}`), ""]
}

function buildDayMarkdown(entry: HistoryEntry): string {
	const lines: string[] = [`## ${formatDateSub(entry.date)}`, ""]
	lines.push(
		...getSectionMarkdown("### Completed", entry.completed),
		...getSectionMarkdown("### Planned", entry.planned),
		...getSectionMarkdown("### Blockers", entry.blockers),
	)
	return lines.join("\n").trim()
}

function buildAllHistoryMarkdown(entries: HistoryEntry[]): string {
	const lines: string[] = ["# My Standup History", ""]
	for (const entry of entries) {
		lines.push(buildDayMarkdown(entry), "")
	}
	return lines.join("\n").trim()
}

async function copyTextToClipboard(text: string) {
	if (
		typeof navigator !== "undefined" &&
		navigator.clipboard &&
		typeof navigator.clipboard.writeText === "function"
	) {
		await navigator.clipboard.writeText(text)
		return
	}

	if (typeof document === "undefined") {
		throw new Error("Clipboard unavailable")
	}

	const textarea = document.createElement("textarea")
	textarea.value = text
	textarea.setAttribute("readonly", "")
	textarea.style.position = "fixed"
	textarea.style.left = "-9999px"
	document.body.appendChild(textarea)
	textarea.select()
	const copied = document.execCommand("copy")
	document.body.removeChild(textarea)
	if (!copied) throw new Error("Failed to copy markdown")
}

function HistoryPage() {
	const trpc = useTRPC()
	const queryClient = useQueryClient()
	const { data: history, isLoading } = useQuery(
		trpc.standups.getMine.queryOptions({ limit: 1000 }),
	)
	const createDayShare = useMutation(
		trpc.standups.createDayShare.mutationOptions(),
	)
	const retractDayShare = useMutation(
		trpc.standups.retractDayShare.mutationOptions(),
	)
	const [copyAllState, setCopyAllState] = useState<"idle" | "copied" | "error">(
		"idle",
	)
	const [copyDayStates, setCopyDayStates] = useState<
		Record<string, "idle" | "copied" | "error">
	>({})
	const [shareDayStates, setShareDayStates] = useState<
		Record<string, DayActionState>
	>({})

	const resetShareDayState = (date: string) => {
		setTimeout(
			() =>
				setShareDayStates((prev) => ({
					...prev,
					[date]: "idle",
				})),
			1800,
		)
	}

	const handleCopyAll = async () => {
		if (!history || history.length === 0) return
		try {
			await copyTextToClipboard(buildAllHistoryMarkdown(history))
			setCopyAllState("copied")
			setTimeout(() => setCopyAllState("idle"), 1800)
		} catch {
			setCopyAllState("error")
			setTimeout(() => setCopyAllState("idle"), 1800)
		}
	}

	const handleCopyDay = async (entry: HistoryEntry) => {
		try {
			await copyTextToClipboard(buildDayMarkdown(entry))
			setCopyDayStates((prev) => ({ ...prev, [entry.date]: "copied" }))
			setTimeout(
				() =>
					setCopyDayStates((prev) => ({
						...prev,
						[entry.date]: "idle",
					})),
				1800,
			)
		} catch {
			setCopyDayStates((prev) => ({ ...prev, [entry.date]: "error" }))
			setTimeout(
				() =>
					setCopyDayStates((prev) => ({
						...prev,
						[entry.date]: "idle",
					})),
				1800,
			)
		}
	}

	const handleCopyShareLink = async (entry: HistoryEntry) => {
		if (!entry.sharedToken) return
		try {
			await copyTextToClipboard(buildShareUrl(entry.sharedToken))
			setShareDayStates((prev) => ({ ...prev, [entry.date]: "copied" }))
		} catch {
			setShareDayStates((prev) => ({ ...prev, [entry.date]: "error" }))
		}
		resetShareDayState(entry.date)
	}

	const handleCreateShare = async (entry: HistoryEntry) => {
		setShareDayStates((prev) => ({ ...prev, [entry.date]: "sharing" }))
		try {
			const result = await createDayShare.mutateAsync({ date: entry.date })
			await queryClient.invalidateQueries()
			await copyTextToClipboard(buildShareUrl(result.token))
			setShareDayStates((prev) => ({ ...prev, [entry.date]: "copied" }))
		} catch {
			setShareDayStates((prev) => ({ ...prev, [entry.date]: "error" }))
		}
		resetShareDayState(entry.date)
	}

	const handleRetractShare = async (entry: HistoryEntry) => {
		setShareDayStates((prev) => ({ ...prev, [entry.date]: "retracting" }))
		try {
			await retractDayShare.mutateAsync({ date: entry.date })
			await queryClient.invalidateQueries()
			setShareDayStates((prev) => ({ ...prev, [entry.date]: "idle" }))
		} catch {
			setShareDayStates((prev) => ({ ...prev, [entry.date]: "error" }))
			resetShareDayState(entry.date)
		}
	}

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			<div className="mb-8 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
						HISTORY
					</h1>
					<p className="text-ds-muted text-sm mt-1">
						// YOUR STANDUP HISTORY
					</p>
				</div>
				{history && history.length > 0 && (
					<button
						type="button"
						onClick={handleCopyAll}
						className={`flex items-center gap-1 border-[2px] px-3 py-1.5 text-[10px] font-extrabold tracking-widest transition-colors ${
							copyAllState === "copied"
								? "border-ds-accent bg-ds-accent/10 text-ds-accent"
								: copyAllState === "error"
									? "border-red-500/60 text-red-500 hover:border-red-400"
									: "border-ds-muted3 text-ds-text-tertiary hover:border-ds-accent hover:text-ds-accent"
						}`}
						title="Copy all history as markdown"
					>
						{copyAllState === "copied" ? (
							<Check className="h-3 w-3" />
						) : (
							<Copy className="h-3 w-3" />
						)}
						{copyAllState === "copied"
							? "COPIED_ALL"
							: copyAllState === "error"
								? "COPY_FAILED"
								: "COPY_ALL_MD"}
					</button>
				)}
			</div>

			{isLoading ? (
				<div className="space-y-6">
					{[1, 2, 3].map((i) => (
						<div key={i}>
							<div className="h-4 w-32 bg-ds-surface2 animate-pulse mb-3" />
							<div className="h-28 border-[3px] border-ds-muted3 p-6 animate-pulse" />
						</div>
					))}
				</div>
			) : history && history.length > 0 ? (
				<div className="space-y-0">
					{history.map((entry) => {
						const heading = formatDateHeading(entry.date)
						const sub = formatDateSub(entry.date)
						const isToday =
							entry.date === new Date().toISOString().split("T")[0]
						const count =
							entry.completed.length +
							entry.planned.length +
							entry.blockers.length
						const copyState = copyDayStates[entry.date] ?? "idle"
						const shareState = shareDayStates[entry.date] ?? "idle"
						const isSharePending =
							shareState === "sharing" || shareState === "retracting"
						const hasSharedLink = Boolean(entry.sharedToken)

						return (
							<div
								key={entry.date}
								className="border-[3px] border-ds-muted3 -mt-[3px]"
							>
								{/* Day header */}
								<div
									className={`flex flex-col gap-2 border-b-[3px] border-ds-muted3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${isToday ? "bg-ds-accent/5" : ""}`}
								>
									<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
										{isToday && (
											<span className="w-2 h-2 bg-ds-accent rounded-full animate-pulse" />
										)}
										<span
											className={`text-sm font-extrabold tracking-wider ${isToday ? "text-ds-accent" : "text-ds-fg"}`}
										>
											{heading}
										</span>
										<span className="text-[11px] text-ds-text-tertiary">{sub}</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-xs font-bold text-ds-text-tertiary tracking-wider">
											{count} {count === 1 ? "ITEM" : "ITEMS"}
										</span>
										<button
											type="button"
											disabled={isSharePending}
											onClick={() =>
												hasSharedLink
													? handleCopyShareLink(entry)
													: handleCreateShare(entry)
											}
											className={`flex items-center gap-1 border-[2px] px-2 py-1 text-[10px] font-extrabold tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
												shareState === "copied"
													? "border-ds-accent bg-ds-accent/10 text-ds-accent"
													: shareState === "error"
														? "border-red-500/60 text-red-500 hover:border-red-400"
														: "border-ds-muted3 text-ds-text-tertiary hover:border-ds-accent hover:text-ds-accent"
											}`}
											title={
												hasSharedLink
													? "Copy public share URL for this day"
													: "Create a public share URL for this day"
											}
										>
											{hasSharedLink ? (
												<Link2 className="h-3 w-3" />
											) : (
												<Copy className="h-3 w-3" />
											)}
											{shareState === "sharing"
												? "SHARING..."
												: shareState === "retracting"
													? "RETRACTING..."
													: shareState === "copied"
														? "LINK_COPIED"
														: shareState === "error"
															? "SHARE_FAILED"
															: hasSharedLink
																? "COPY_URL"
																: "SHARE_URL"}
										</button>
										{hasSharedLink && (
											<button
												type="button"
												disabled={isSharePending}
												onClick={() => handleRetractShare(entry)}
												className="flex items-center gap-1 border-[2px] border-red-500/45 px-2 py-1 text-[10px] font-extrabold tracking-widest text-red-500 transition-colors hover:border-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
												title="Retract this public share URL"
											>
												<Link2Off className="h-3 w-3" />
												RETRACT
											</button>
										)}
										<button
											type="button"
											onClick={() => handleCopyDay(entry)}
											className={`flex items-center gap-1 border-[2px] px-2 py-1 text-[10px] font-extrabold tracking-widest transition-colors ${
												copyState === "copied"
													? "border-ds-accent bg-ds-accent/10 text-ds-accent"
													: copyState === "error"
														? "border-red-500/60 text-red-500 hover:border-red-400"
														: "border-ds-muted3 text-ds-text-tertiary hover:border-ds-accent hover:text-ds-accent"
											}`}
											title="Copy this day as markdown"
										>
											{copyState === "copied" ? (
												<Check className="h-3 w-3" />
											) : (
												<Copy className="h-3 w-3" />
											)}
											{copyState === "copied"
												? "COPIED"
												: copyState === "error"
													? "COPY_FAILED"
													: "COPY_DAY_MD"}
										</button>
									</div>
								</div>

								{/* Content */}
								<div className="px-4 py-4 sm:px-5">
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
				<div className="border-[3px] border-ds-muted3 p-8 text-center sm:p-12">
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
			<div className="flex items-center gap-1.5 mb-2">
				<span className={c.text}>{icon}</span>
				<span
					className={`text-[10px] font-extrabold tracking-widest ${c.text}`}
				>
					{label}
				</span>
				<span className="text-[10px] text-ds-text-tertiary font-bold">
					{items.length}
				</span>
			</div>
			<div className="space-y-1.5">
				{items.map((item, i) => (
					<div
						key={i}
						className={`border-l-[2px] ${c.border} ${c.bg} px-2.5 py-1.5`}
					>
						<span className="break-words text-xs leading-relaxed text-ds-text-secondary">
							<AutoLinkText text={item} linkClassName={c.link} />
						</span>
					</div>
				))}
			</div>
		</div>
	)
}
