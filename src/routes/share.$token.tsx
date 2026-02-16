import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Target } from "lucide-react";
import type { ReactNode } from "react";
import { AutoLinkText } from "@/components/auto-link-text";
import { useTRPC } from "@/integrations/trpc/react";

export const Route = createFileRoute("/share/$token")({
	component: SharedStandupPage,
});

function SharedStandupPage() {
	const { token } = Route.useParams();
	const trpc = useTRPC();
	const { data, isLoading, isError } = useQuery(
		trpc.standups.getSharedByToken.queryOptions({ token }),
	);
	const hasAnyItems = data
		? data.completed.length + data.planned.length + data.blockers.length > 0
		: false;

	return (
		<div className="min-h-screen bg-ds-bg px-4 py-6 text-ds-fg sm:px-6 sm:py-8">
			<div className="mx-auto w-full max-w-[1200px]">
				{isLoading ? (
					<div className="space-y-4">
						<div className="h-7 w-48 animate-pulse bg-ds-surface2" />
						<div className="h-5 w-72 animate-pulse bg-ds-surface2" />
						<div className="h-56 animate-pulse border-[3px] border-ds-muted3 bg-ds-bg" />
					</div>
				) : isError || !data ? (
					<div className="border-[3px] border-ds-muted3 p-6 sm:p-8">
						<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
							SHARED_STANDUP
						</h1>
						<p className="mt-2 text-sm text-ds-muted">// LINK_UNAVAILABLE</p>
						<p className="mt-6 text-sm text-ds-text-secondary">
							This share link was retracted or is invalid.
						</p>
						<Link
							to="/"
							className="mt-6 inline-flex items-center border-[2px] border-ds-muted3 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
						>
							GO_HOME
						</Link>
					</div>
				) : (
					<div className="space-y-5">
						<div>
							<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
								SHARED_STANDUP
							</h1>
							<p className="mt-1 text-sm text-ds-muted">
								// {data.user.name.toUpperCase()} •{" "}
								{formatDateSub(data.date).toUpperCase()}
							</p>
						</div>

						<div className="border-[3px] border-ds-muted3">
							<div className="border-b-[3px] border-ds-muted3 px-4 py-3 sm:px-5">
								<span className="text-sm font-extrabold tracking-wider text-ds-fg">
									{formatDateHeading(data.date)}
								</span>
								<span className="ml-3 text-[11px] text-ds-text-tertiary">
									{formatDateSub(data.date)}
								</span>
							</div>
							<div className="px-4 py-4 sm:px-5">
								{hasAnyItems ? (
									<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
										{data.completed.length > 0 && (
											<EntryColumn
												icon={<CheckCircle2 className="h-3 w-3" />}
												label="DONE"
												color="lime"
												items={data.completed}
											/>
										)}
										{data.planned.length > 0 && (
											<EntryColumn
												icon={<Target className="h-3 w-3" />}
												label="NEXT"
												color="cyan"
												items={data.planned}
											/>
										)}
										{data.blockers.length > 0 && (
											<EntryColumn
												icon={<AlertTriangle className="h-3 w-3" />}
												label="BLOCKED"
												color="red"
												items={data.blockers}
											/>
										)}
									</div>
								) : (
									<p className="text-sm text-ds-muted">
										NO_ITEMS // This day has no standup entries.
									</p>
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
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

function formatDateHeading(dateStr: string): string {
	const date = new Date(dateStr + "T12:00:00");
	return date
		.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		})
		.toUpperCase();
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
	icon: ReactNode;
	label: string;
	color: "lime" | "cyan" | "red";
	items: string[];
}) {
	const c = colorMap[color];

	return (
		<div>
			<div className="mb-2 flex items-center gap-1.5">
				<span className={c.text}>{icon}</span>
				<span
					className={`text-[10px] font-extrabold tracking-widest ${c.text}`}
				>
					{label}
				</span>
				<span className="text-[10px] font-bold text-ds-text-tertiary">
					{items.length}
				</span>
			</div>
			<div className="space-y-1.5">
				{items.map((item, index) => (
					<div
						key={index}
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
