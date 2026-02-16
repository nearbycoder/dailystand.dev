import { usePostHog } from "@posthog/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangle,
	CheckCircle2,
	Plus,
	Save,
	Target,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTRPC } from "@/integrations/trpc/react";
import { authClient } from "@/lib/auth-client";
import { getLocalDateString } from "@/lib/date";

export const Route = createFileRoute("/app/standup")({
	component: StandupForm,
});

type SubmitMode = "same" | "different";

type StandupDraft = {
	completed: string[];
	planned: string[];
	blockers: string[];
};

type StandupSubmitEntry = {
	type: "completed" | "planned" | "blocker";
	content: string;
};

function createEmptyDraft(): StandupDraft {
	return { completed: [""], planned: [""], blockers: [""] };
}

function draftFromEntries(
	entries: Array<{ type: string; content: string }>,
): StandupDraft {
	const draft: StandupDraft = {
		completed: [],
		planned: [],
		blockers: [],
	};

	for (const entry of entries) {
		if (entry.type === "completed") draft.completed.push(entry.content);
		else if (entry.type === "planned") draft.planned.push(entry.content);
		else if (entry.type === "blocker") draft.blockers.push(entry.content);
	}

	if (draft.completed.length === 0) draft.completed.push("");
	if (draft.planned.length === 0) draft.planned.push("");
	if (draft.blockers.length === 0) draft.blockers.push("");

	return draft;
}

function entriesFromDraft(draft: StandupDraft): StandupSubmitEntry[] {
	return [
		...draft.completed
			.filter((value) => value.trim())
			.map((content) => ({ type: "completed" as const, content })),
		...draft.planned
			.filter((value) => value.trim())
			.map((content) => ({ type: "planned" as const, content })),
		...draft.blockers
			.filter((value) => value.trim())
			.map((content) => ({ type: "blocker" as const, content })),
	];
}

function StandupForm() {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const posthog = usePostHog();
	const queryClient = useQueryClient();
	const today = useMemo(() => getLocalDateString(), []);

	const { data: session } = authClient.useSession();
	const { data: existing } = useQuery(
		trpc.standups.getMyToday.queryOptions({ date: today }),
	);
	const { data: teams } = useQuery(trpc.teams.list.queryOptions());

	const userTeams = useMemo(() => {
		const userId = session?.user?.id;
		if (!userId || !teams) return [];
		return teams.filter((team) =>
			team.members.some((member) => member.id === userId),
		);
	}, [session?.user?.id, teams]);

	const userTeamIds = useMemo(
		() => userTeams.map((team) => team.id),
		[userTeams],
	);
	const hasMultipleTeams = userTeamIds.length > 1;

	const [mode, setMode] = useState<SubmitMode>("same");
	const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
	const [sharedDraft, setSharedDraft] =
		useState<StandupDraft>(createEmptyDraft);
	const [teamDrafts, setTeamDrafts] = useState<Record<string, StandupDraft>>(
		{},
	);
	const [submitError, setSubmitError] = useState("");
	const [initialized, setInitialized] = useState(false);

	useEffect(() => {
		if (initialized) return;
		if (!session?.user?.id) return;
		if (existing === undefined || teams === undefined) return;

		const byScope = new Map<string, typeof existing>();
		for (const entry of existing) {
			const scope = entry.teamId ?? "__GLOBAL__";
			if (!byScope.has(scope)) {
				byScope.set(scope, []);
			}
			byScope.get(scope)!.push(entry);
		}

		const globalDraft = draftFromEntries(byScope.get("__GLOBAL__") ?? []);
		const nextTeamDrafts: Record<string, StandupDraft> = {};

		for (const [scope, scopeEntries] of byScope.entries()) {
			if (scope === "__GLOBAL__") continue;
			nextTeamDrafts[scope] = draftFromEntries(scopeEntries);
		}

		const teamDraftIds = Object.keys(nextTeamDrafts).filter((id) =>
			userTeamIds.includes(id),
		);
		const nextSelected = teamDraftIds.length > 0 ? teamDraftIds : userTeamIds;
		setSelectedTeamIds(nextSelected);
		setTeamDrafts(nextTeamDrafts);

		if (byScope.has("__GLOBAL__")) {
			setSharedDraft(globalDraft);
		} else if (teamDraftIds.length > 0) {
			setSharedDraft(nextTeamDrafts[teamDraftIds[0]] ?? createEmptyDraft());
		} else {
			setSharedDraft(createEmptyDraft());
		}

		if (
			teamDraftIds.length > 1 ||
			(teamDraftIds.length === 1 &&
				!byScope.has("__GLOBAL__") &&
				hasMultipleTeams)
		) {
			setMode("different");
		}

		setInitialized(true);
	}, [
		existing,
		teams,
		initialized,
		userTeamIds,
		hasMultipleTeams,
		session?.user?.id,
	]);

	const batchUpsert = useMutation(
		trpc.standups.upsertBatch.mutationOptions({
			onSuccess: (_data, variables) => {
				// Track standup submitted event
				const submissions = variables.submissions ?? [];
				const totalEntries = submissions.reduce(
					(sum, submission) => sum + submission.entries.length,
					0,
				);
				const completedCount = submissions.reduce(
					(sum, submission) =>
						sum +
						submission.entries.filter((entry) => entry.type === "completed")
							.length,
					0,
				);
				const plannedCount = submissions.reduce(
					(sum, submission) =>
						sum +
						submission.entries.filter((entry) => entry.type === "planned")
							.length,
					0,
				);
				const blockerCount = submissions.reduce(
					(sum, submission) =>
						sum +
						submission.entries.filter((entry) => entry.type === "blocker")
							.length,
					0,
				);
				posthog.capture("standup_submitted", {
					date: variables.date,
					total_entries: totalEntries,
					completed_count: completedCount,
					planned_count: plannedCount,
					blocker_count: blockerCount,
					team_count: submissions.length,
					mode: mode,
					is_update: existing && existing.length > 0,
				});
				queryClient.invalidateQueries();
				navigate({ to: "/app/history" });
			},
			onError: (error) => {
				setSubmitError(error.message || "Failed to save standup");
				posthog.captureException(
					new Error(error.message || "Failed to save standup"),
				);
			},
		}),
	);

	const updateSharedSection = useCallback(
		(section: keyof StandupDraft, items: string[]) => {
			setSharedDraft((prev) => ({
				...prev,
				[section]: items,
			}));
		},
		[],
	);

	const updateTeamSection = useCallback(
		(teamId: string, section: keyof StandupDraft, items: string[]) => {
			setTeamDrafts((prev) => ({
				...prev,
				[teamId]: {
					...(prev[teamId] ?? createEmptyDraft()),
					[section]: items,
				},
			}));
		},
		[],
	);

	const toggleTeamSelection = (teamId: string) => {
		setSelectedTeamIds((prev) =>
			prev.includes(teamId)
				? prev.filter((id) => id !== teamId)
				: [...prev, teamId],
		);
	};

	const selectedTeams = useMemo(
		() => userTeams.filter((team) => selectedTeamIds.includes(team.id)),
		[userTeams, selectedTeamIds],
	);

	const doSubmit = useCallback(() => {
		setSubmitError("");

		let submissions: Array<{
			teamId: string | null;
			entries: StandupSubmitEntry[];
		}> = [];
		let managedScopes: Array<string | null> = [null];

		if (userTeamIds.length === 0) {
			submissions = [{ teamId: null, entries: entriesFromDraft(sharedDraft) }];
		} else if (mode === "same") {
			if (selectedTeamIds.length === 0) {
				setSubmitError("Select at least one team to submit for.");
				return;
			}

			const sharedEntries = entriesFromDraft(sharedDraft);
			const allTeamsSelected = selectedTeamIds.length === userTeamIds.length;

			submissions =
				allTeamsSelected && userTeamIds.length > 1
					? [{ teamId: null, entries: sharedEntries }]
					: selectedTeamIds.map((teamId) => ({
							teamId,
							entries: sharedEntries,
						}));
			managedScopes =
				allTeamsSelected && userTeamIds.length > 1
					? [null, ...userTeamIds]
					: [null, ...selectedTeamIds];
		} else {
			if (selectedTeamIds.length === 0) {
				setSubmitError("Select at least one team to submit for.");
				return;
			}

			submissions = selectedTeamIds.map((teamId) => ({
				teamId,
				entries: entriesFromDraft(teamDrafts[teamId] ?? createEmptyDraft()),
			}));
			managedScopes = [null, ...selectedTeamIds];
		}

		batchUpsert.mutate({
			date: today,
			replaceScopes: managedScopes,
			submissions,
		});
	}, [
		batchUpsert,
		mode,
		selectedTeamIds,
		sharedDraft,
		teamDrafts,
		today,
		userTeamIds,
	]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		doSubmit();
	};

	// Cmd/Ctrl+Enter to submit from anywhere in the form.
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				doSubmit();
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [doSubmit]);

	const isMac =
		typeof navigator !== "undefined" && navigator.platform.includes("Mac");

	const submitLabel =
		userTeamIds.length === 0
			? existing && existing.length > 0
				? "UPDATE_STANDUP"
				: "SUBMIT_STANDUP"
			: mode === "different"
				? "SUBMIT_TEAM_STANDUPS"
				: selectedTeamIds.length === userTeamIds.length &&
						userTeamIds.length > 1
					? "SUBMIT_SAME_FOR_ALL_TEAMS"
					: "SUBMIT_SAME_FOR_SELECTED";

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			<div className="mb-8">
				<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
					STANDUP
				</h1>
				<p className="text-ds-text-tertiary text-sm mt-1">
					//{" "}
					{new Date()
						.toLocaleDateString("en-US", {
							weekday: "long",
							month: "long",
							day: "numeric",
						})
						.toUpperCase()}
				</p>
			</div>

			{userTeamIds.length > 0 && (
				<div className="mb-6 border-[3px] border-ds-muted2 bg-ds-surface/20 p-4 dark:border-ds-muted3 dark:bg-ds-surface/10 sm:p-5">
					<div className="text-[10px] font-bold tracking-widest text-ds-muted2">
						// TEAM_SCOPE
					</div>
					<div className="mt-3 flex flex-wrap gap-3">
						{userTeams.map((team) => (
							<label
								key={team.id}
								className="flex items-center gap-2 text-xs font-bold text-ds-text-tertiary"
							>
								<input
									type="checkbox"
									checked={selectedTeamIds.includes(team.id)}
									onChange={() => toggleTeamSelection(team.id)}
									className="h-3.5 w-3.5 border-ds-muted3 bg-ds-input-bg accent-ds-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent/40"
								/>
								<span>{team.name.toUpperCase()}</span>
							</label>
						))}
					</div>

					{hasMultipleTeams && (
						<div className="mt-4 flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => setMode("same")}
								className={`border-[2px] px-3 py-1.5 text-[10px] font-extrabold tracking-widest transition-colors ${
									mode === "same"
										? "border-ds-accent bg-ds-accent/10 text-ds-accent"
										: "border-ds-muted3 text-ds-text-tertiary hover:border-ds-accent"
								}`}
							>
								SAME_UPDATE
							</button>
							<button
								type="button"
								onClick={() => setMode("different")}
								className={`border-[2px] px-3 py-1.5 text-[10px] font-extrabold tracking-widest transition-colors ${
									mode === "different"
										? "border-ds-accent bg-ds-accent/10 text-ds-accent"
										: "border-ds-muted3 text-ds-text-tertiary hover:border-ds-accent"
								}`}
							>
								CUSTOM_PER_TEAM
							</button>
						</div>
					)}

					<p className="mt-3 text-xs text-ds-text-tertiary">
						{mode === "same"
							? "Use one standup and apply it to selected teams."
							: "Write a separate standup for each selected team."}
					</p>
				</div>
			)}

			<form onSubmit={handleSubmit} className="space-y-0">
				{mode === "same" || userTeamIds.length <= 1 ? (
					<>
						<EntrySection
							stacked={false}
							icon={
								<CheckCircle2 className="w-4 h-4 text-lime-500 dark:text-lime-400" />
							}
							title="COMPLETED"
							color="lime"
							items={sharedDraft.completed}
							onChange={(items) => updateSharedSection("completed", items)}
							placeholder="Finished the API integration..."
						/>
						<EntrySection
							icon={
								<Target className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
							}
							title="PLANNED"
							color="cyan"
							items={sharedDraft.planned}
							onChange={(items) => updateSharedSection("planned", items)}
							placeholder="Start building the dashboard..."
						/>
						<EntrySection
							icon={
								<AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
							}
							title="BLOCKERS"
							color="red"
							items={sharedDraft.blockers}
							onChange={(items) => updateSharedSection("blockers", items)}
							placeholder="Waiting on design review..."
						/>
					</>
				) : selectedTeams.length > 0 ? (
					<div className="space-y-6">
						{selectedTeams.map((team) => {
							const teamDraft = teamDrafts[team.id] ?? createEmptyDraft();
							return (
								<div
									key={team.id}
									className="border-[3px] border-ds-muted2 bg-ds-surface/20 p-4 dark:border-ds-muted3 dark:bg-ds-surface/10 sm:p-5"
								>
									<div className="mb-4 text-xs font-extrabold tracking-widest text-ds-accent">
										TEAM // {team.name.toUpperCase()}
									</div>
									<EntrySection
										stacked={false}
										icon={
											<CheckCircle2 className="w-4 h-4 text-lime-500 dark:text-lime-400" />
										}
										title="COMPLETED"
										color="lime"
										items={teamDraft.completed}
										onChange={(items) =>
											updateTeamSection(team.id, "completed", items)
										}
										placeholder="Finished the API integration..."
									/>
									<EntrySection
										icon={
											<Target className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
										}
										title="PLANNED"
										color="cyan"
										items={teamDraft.planned}
										onChange={(items) =>
											updateTeamSection(team.id, "planned", items)
										}
										placeholder="Start building the dashboard..."
									/>
									<EntrySection
										icon={
											<AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
										}
										title="BLOCKERS"
										color="red"
										items={teamDraft.blockers}
										onChange={(items) =>
											updateTeamSection(team.id, "blockers", items)
										}
										placeholder="Waiting on design review..."
									/>
								</div>
							);
						})}
					</div>
				) : (
					<div className="border-[3px] border-ds-muted3 p-6 text-center text-sm text-ds-text-tertiary">
						Select at least one team to submit your standup.
					</div>
				)}

				{submitError && (
					<div className="mt-4 border-[3px] border-red-500 bg-red-500/10 p-3 text-sm font-bold text-red-400">
						ERROR: {submitError}
					</div>
				)}

				<div className="mt-6 flex justify-end">
					<button
						type="submit"
						disabled={batchUpsert.isPending}
						className="inline-flex flex-wrap items-center justify-center gap-2 bg-ds-accent px-5 py-3 text-sm font-extrabold tracking-wider text-ds-accent-fg transition-colors hover:bg-ds-accent-hover disabled:opacity-50 sm:gap-3"
					>
						<Save className="w-4 h-4" />
						{batchUpsert.isPending ? "SAVING..." : submitLabel}
						<kbd className="rounded-sm bg-ds-accent-fg/15 px-2 py-0.5 text-[10px] font-bold">
							{isMac ? "⌘" : "Ctrl"}+Enter
						</kbd>
					</button>
				</div>
			</form>
		</div>
	);
}

function EntrySection({
	icon,
	title,
	color,
	items,
	onChange,
	placeholder,
	stacked = true,
}: {
	icon: React.ReactNode;
	title: string;
	color: string;
	items: string[];
	onChange: (items: string[]) => void;
	placeholder: string;
	stacked?: boolean;
}) {
	const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

	const focusItem = useCallback((index: number) => {
		requestAnimationFrame(() => {
			inputRefs.current[index]?.focus();
		});
	}, []);

	const addItem = (afterIndex?: number) => {
		const insertAt = afterIndex !== undefined ? afterIndex + 1 : items.length;
		const newItems = [...items];
		newItems.splice(insertAt, 0, "");
		onChange(newItems);
		focusItem(insertAt);
	};

	const removeItem = (index: number) => {
		if (items.length <= 1) {
			onChange([""]);
			focusItem(0);
			return;
		}
		onChange(items.filter((_, i) => i !== index));
		focusItem(Math.max(0, index - 1));
	};

	const updateItem = (index: number, value: string) => {
		const newItems = [...items];
		newItems[index] = value;
		onChange(newItems);
	};

	const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
		if (e.key === "Enter") {
			e.preventDefault();
			addItem(index);
		} else if (
			e.key === "Backspace" &&
			items[index] === "" &&
			items.length > 1
		) {
			e.preventDefault();
			removeItem(index);
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			if (index < items.length - 1) focusItem(index + 1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (index > 0) focusItem(index - 1);
		}
	};

	const colorClasses: Record<string, string> = {
		lime: "text-lime-600 dark:text-lime-400",
		cyan: "text-cyan-600 dark:text-cyan-400",
		red: "text-red-500 dark:text-red-400",
	};

	return (
		<div
			className={`${stacked ? "-mt-[3px]" : ""} border-[3px] border-ds-muted2 bg-ds-surface/20 p-4 dark:border-ds-muted3 dark:bg-ds-surface/10 sm:p-6`}
		>
			<div className="mb-4 flex flex-wrap items-center gap-2">
				{icon}
				<span
					className={`text-xs font-extrabold tracking-widest ${colorClasses[color] ?? ""}`}
				>
					{title}
				</span>
				<span className="ml-0 w-full text-[10px] font-bold tracking-wider text-ds-text-tertiary sm:ml-auto sm:w-auto">
					ENTER=NEW / BKSP=DEL / ↑↓=NAV
				</span>
			</div>
			<div className="space-y-2">
				{items.map((item, index) => (
					<div key={index} className="group flex items-start gap-2">
						<span className="pt-2 text-sm font-mono text-ds-text-tertiary">
							&gt;
						</span>
						<input
							ref={(el) => {
								inputRefs.current[index] = el;
							}}
							value={item}
							onChange={(e) => updateItem(index, e.target.value)}
							onKeyDown={(e) => handleKeyDown(e, index)}
							placeholder={index === 0 ? placeholder : "..."}
							className="min-w-0 flex-1 bg-ds-input-bg border-[3px] border-ds-muted2 px-3 py-2 text-ds-fg font-mono text-sm transition-colors placeholder:text-ds-muted2 dark:border-ds-muted3 focus:border-ds-accent focus:outline-none"
						/>
						<button
							type="button"
							tabIndex={-1}
							onClick={() => removeItem(index)}
							className="p-1 pt-2 text-ds-text-tertiary opacity-70 transition-colors hover:text-red-400 focus:opacity-100 sm:pt-1 sm:opacity-0 sm:group-hover:opacity-100"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
				))}
				<button
					type="button"
					onClick={() => addItem()}
					className="flex items-center gap-2 text-xs font-bold text-ds-text-tertiary hover:text-ds-accent transition-colors pt-1"
				>
					<Plus className="w-3 h-3" />
					ADD_ITEM
				</button>
			</div>
		</div>
	);
}
