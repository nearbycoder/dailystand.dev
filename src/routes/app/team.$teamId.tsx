import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	Copy,
	Target,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AutoLinkText } from "@/components/auto-link-text";
import { useTRPC } from "@/integrations/trpc/react";

export const Route = createFileRoute("/app/team/$teamId")({
	component: TeamView,
});

const PAGE_SIZE = 5; // days per page

type TeamDayStandup = {
	user: { id: string; name: string; image: string | null };
	completed: string[];
	planned: string[];
	blockers: string[];
};

function formatDateHeading(dateStr: string): string {
	const date = new Date(dateStr + "T12:00:00");
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);

	const todayStr = today.toISOString().split("T")[0];
	const yesterdayStr = yesterday.toISOString().split("T")[0];

	if (dateStr === todayStr) return "TODAY";
	if (dateStr === yesterdayStr) return "YESTERDAY";

	return date
		.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		})
		.toUpperCase();
}

function formatDateSub(dateStr: string): string {
	const date = new Date(dateStr + "T12:00:00");
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function getDateRange(page: number): { startDate: string; endDate: string } {
	const end = new Date();
	end.setDate(end.getDate() - page * PAGE_SIZE);
	const start = new Date(end);
	start.setDate(start.getDate() - (PAGE_SIZE - 1));

	return {
		startDate: start.toISOString().split("T")[0],
		endDate: end.toISOString().split("T")[0],
	};
}

function getSectionMarkdown(label: string, items: string[]): string[] {
	if (items.length === 0) return [];
	return [label, ...items.map((item) => `- ${item}`), ""];
}

function buildDayMarkdown({
	teamName,
	date,
	standups,
}: {
	teamName: string;
	date: string;
	standups: TeamDayStandup[];
}): string {
	const headingDate = formatDateSub(date);
	const lines: string[] = [`# ${teamName} - ${headingDate}`, ""];

	const sortedStandups = [...standups].sort((a, b) =>
		a.user.name.localeCompare(b.user.name),
	);

	for (const standup of sortedStandups) {
		lines.push(`## ${standup.user.name}`);
		lines.push(
			...getSectionMarkdown("### Completed", standup.completed),
			...getSectionMarkdown("### Planned", standup.planned),
			...getSectionMarkdown("### Blockers", standup.blockers),
		);
	}

	return lines.join("\n").trim();
}

async function copyTextToClipboard(text: string) {
	if (
		typeof navigator !== "undefined" &&
		navigator.clipboard &&
		typeof navigator.clipboard.writeText === "function"
	) {
		await navigator.clipboard.writeText(text);
		return;
	}

	if (typeof document === "undefined") {
		throw new Error("Clipboard unavailable");
	}

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.left = "-9999px";
	document.body.appendChild(textarea);
	textarea.select();

	const copied = document.execCommand("copy");
	document.body.removeChild(textarea);
	if (!copied) throw new Error("Failed to copy markdown");
}

function TeamView() {
	const { teamId } = Route.useParams();
	const trpc = useTRPC();
	const [page, setPage] = useState(0);

	const { startDate, endDate } = useMemo(() => getDateRange(page), [page]);

	const { data: teams } = useQuery(trpc.teams.list.queryOptions());
	const {
		data: timelineData,
		isLoading,
		isError,
		error,
	} = useQuery({
		...trpc.standups.getByDateRange.queryOptions({
			startDate,
			endDate,
			teamId,
		}),
		retry: false,
	});
	const { data: members } = useQuery(
		trpc.teams.getMembers.queryOptions({ teamId }),
	);

	const team = teams?.find((t) => t.id === teamId);

	// Build all dates in range (so empty days show too)
	const allDates = useMemo(() => {
		const dates: string[] = [];
		const cur = new Date(endDate + "T12:00:00");
		const stop = new Date(startDate + "T12:00:00");
		while (cur >= stop) {
			dates.push(cur.toISOString().split("T")[0]);
			cur.setDate(cur.getDate() - 1);
		}
		return dates;
	}, [startDate, endDate]);

	const dataByDate = useMemo(() => {
		const map = new Map<
			string,
			{
				user: { id: string; name: string; image: string | null };
				completed: string[];
				planned: string[];
				blockers: string[];
			}[]
		>();
		if (timelineData) {
			for (const day of timelineData) {
				map.set(day.date, day.standups);
			}
		}
		return map;
	}, [timelineData]);

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			{/* Header */}
			<div className="mb-8 flex items-center gap-3">
				<div className="w-10 h-10 bg-ds-accent text-ds-accent-fg flex items-center justify-center">
					<Users className="w-5 h-5" />
				</div>
				<div>
					<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
						{team?.name?.toUpperCase() ?? "TEAM"}
					</h1>
					<p className="text-ds-muted text-sm">
						// {members?.length ?? 0} MEMBERS
					</p>
				</div>
			</div>

			{/* Pagination Controls */}
			<div className="mb-6 border-[3px] border-ds-border p-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<button
						type="button"
						onClick={() => setPage((p) => p + 1)}
						className="order-1 flex items-center gap-1.5 px-2 py-1 text-xs font-bold tracking-wider text-ds-text-tertiary transition-colors hover:text-ds-fg"
					>
						<ChevronLeft className="w-4 h-4" />
						OLDER
					</button>

					<div className="order-3 w-full text-center sm:order-2 sm:w-auto">
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

					<div className="order-2 flex items-center justify-end gap-1 sm:order-3">
						{page > 0 && (
							<button
								type="button"
								onClick={() => setPage(0)}
								className="flex items-center gap-1 px-2 py-1 text-xs font-bold tracking-wider text-ds-text-tertiary transition-colors hover:text-ds-accent"
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
							className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold tracking-wider text-ds-text-tertiary transition-colors hover:text-ds-fg disabled:cursor-not-allowed disabled:opacity-25"
						>
							NEWER
							<ChevronRight className="w-4 h-4" />
						</button>
					</div>
				</div>
			</div>

			{/* Timeline */}
			{isLoading ? (
				<div className="space-y-6">
					{[1, 2, 3].map((i) => (
						<div key={i}>
							<div className="h-4 w-32 bg-ds-surface2 animate-pulse mb-3" />
							<div className="h-28 border-[3px] border-ds-border p-6 animate-pulse" />
						</div>
					))}
				</div>
			) : isError ? (
				<div className="border-[3px] border-red-500/60 bg-red-500/5 px-4 py-3 text-sm text-red-400">
					TEAM_TIMELINE_ERROR //{" "}
					{error instanceof Error
						? error.message
						: "Unable to load team standups."}
				</div>
			) : (
				<div className="space-y-0">
					{allDates.map((date) => {
						const standups = dataByDate.get(date);
						return (
							<DaySection
								key={date}
								date={date}
								teamName={team?.name ?? "Team"}
								standups={standups ?? []}
							/>
						);
					})}
				</div>
			)}

			{/* Keyboard hint */}
			<div className="mt-6 text-center text-[10px] text-ds-muted3 font-bold tracking-widest">
				// SHOWING {PAGE_SIZE} DAYS PER PAGE
			</div>
		</div>
	);
}

function DaySection({
	date,
	teamName,
	standups,
}: {
	date: string;
	teamName: string;
	standups: TeamDayStandup[];
}) {
	const isToday = date === new Date().toISOString().split("T")[0];
	const hasStandups = standups.length > 0;
	const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
		"idle",
	);
	const isWeekend = (() => {
		const d = new Date(date + "T12:00:00").getDay();
		return d === 0 || d === 6;
	})();

	const handleCopyMarkdown = async () => {
		if (!hasStandups) return;
		try {
			const markdown = buildDayMarkdown({
				teamName,
				date,
				standups,
			});
			await copyTextToClipboard(markdown);
			setCopyState("copied");
			setTimeout(() => setCopyState("idle"), 1800);
		} catch {
			setCopyState("error");
			setTimeout(() => setCopyState("idle"), 1800);
		}
	};

	return (
		<div className="border-[3px] border-ds-muted3 -mt-[3px]">
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
						{formatDateHeading(date)}
					</span>
					<span className="text-[11px] text-ds-text-tertiary">
						{formatDateSub(date)}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs font-bold text-ds-text-tertiary tracking-wider">
						{hasStandups
							? `${standups.length} ${standups.length === 1 ? "UPDATE" : "UPDATES"}`
							: isWeekend
								? "WEEKEND"
								: "NO_UPDATES"}
					</span>
					{hasStandups && (
						<button
							type="button"
							onClick={handleCopyMarkdown}
							className={`flex items-center gap-1 border-[2px] px-2 py-1 text-[10px] font-extrabold tracking-widest transition-colors ${
								copyState === "copied"
									? "border-ds-accent bg-ds-accent/10 text-ds-accent"
									: copyState === "error"
										? "border-red-500/60 text-red-500 hover:border-red-400"
										: "border-ds-muted3 text-ds-text-tertiary hover:border-ds-accent hover:text-ds-accent"
							}`}
							title="Copy this day's team updates as markdown"
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
									: "COPY_MD"}
						</button>
					)}
				</div>
			</div>

			{/* Standups for this day */}
			{hasStandups ? (
				<div>
					{standups.map((standup) => (
						<div
							key={standup.user.id}
							className="border-b-[2px] border-ds-muted3/70 px-4 py-4 last:border-b-0 sm:px-5"
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
							<div className="grid grid-cols-1 gap-3 pl-0 sm:pl-10 md:grid-cols-3">
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
					className={`px-4 py-3 text-xs sm:px-5 ${isWeekend ? "text-ds-muted3" : "text-ds-muted2"}`}
				>
					{isWeekend
						? "// weekend — no standups expected"
						: "// no submissions for this day"}
				</div>
			)}
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

function EntryColumn({
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
	);
}
