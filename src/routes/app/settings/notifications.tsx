import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Save } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/trpc/react";

export const Route = createFileRoute("/app/settings/notifications")({
	component: NotificationSettingsPage,
});

type Cadence = "weekly" | "daily";

function NotificationSettingsPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data, isLoading } = useQuery(
		trpc.org.getEmailDigestPreference.queryOptions(),
	);
	const updatePreference = useMutation(
		trpc.org.updateEmailDigestPreference.mutationOptions(),
	);

	const [enabled, setEnabled] = useState(false);
	const [cadence, setCadence] = useState<Cadence>("weekly");
	const [timezone, setTimezone] = useState("UTC");

	useEffect(() => {
		if (!data) return;
		setEnabled(data.enabled);
		setCadence((data.cadence as Cadence) ?? "weekly");
		setTimezone(
			data.timezone ||
				Intl.DateTimeFormat().resolvedOptions().timeZone ||
				"UTC",
		);
	}, [data]);

	const save = async () => {
		try {
			await updatePreference.mutateAsync({
				enabled,
				cadence,
				timezone:
					timezone.trim() ||
					Intl.DateTimeFormat().resolvedOptions().timeZone ||
					"UTC",
			});
			await queryClient.invalidateQueries(
				trpc.org.getEmailDigestPreference.queryFilter(),
			);
			toast.success("Notification settings saved");
		} catch (error) {
			toast.error("Failed to save notification settings", {
				description:
					error instanceof Error ? error.message : "Unexpected server error.",
			});
		}
	};

	const isDailyAllowed = data?.isDailyAllowed ?? false;
	const saving = updatePreference.isPending;

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			<div className="mb-8">
				<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
					NOTIFICATIONS
				</h1>
				<p className="text-ds-muted text-sm mt-1">
					// EMAIL DIGEST WORKFLOWS
				</p>
			</div>

			<div className="border-[3px] border-ds-border p-4 sm:p-6">
				<div className="mb-4 flex items-center gap-2">
					<BellRing className="h-4 w-4 text-ds-accent" />
					<span className="text-sm font-extrabold tracking-widest text-ds-accent">
						STANDUP_EMAIL_DIGEST
					</span>
				</div>

				{isLoading ? (
					<div className="h-20 animate-pulse bg-ds-surface" />
				) : (
					<div className="space-y-5">
						<label className="flex items-center gap-2 text-xs font-bold tracking-wider text-ds-muted">
							<input
								type="checkbox"
								checked={enabled}
								onChange={(event) => setEnabled(event.target.checked)}
								className="h-3.5 w-3.5 accent-ds-accent"
							/>
							ENABLE_EMAIL_DIGESTS
						</label>

						<div>
							<label className="mb-2 block text-xs font-bold tracking-widest text-ds-text-tertiary">
								DIGEST_FREQUENCY
							</label>
							<select
								value={cadence}
								onChange={(event) => setCadence(event.target.value as Cadence)}
								className="w-full max-w-[260px] bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-2.5 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors"
							>
								<option value="weekly">WEEKLY</option>
								<option value="daily" disabled={!isDailyAllowed}>
									DAILY {!isDailyAllowed ? "(PAID_PLAN_REQUIRED)" : ""}
								</option>
							</select>
							<p className="mt-2 text-xs text-ds-muted">
								Free plan is limited to weekly emails. Pro and Business can use
								daily or weekly digests.
							</p>
						</div>

						<div>
							<label className="mb-2 block text-xs font-bold tracking-widest text-ds-text-tertiary">
								TIMEZONE
							</label>
							<input
								value={timezone}
								onChange={(event) => setTimezone(event.target.value)}
								placeholder="America/New_York"
								className="w-full max-w-[360px] bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-2.5 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors"
							/>
							<p className="mt-2 text-xs text-ds-muted">
								Used for digest windows and delivery dedupe.
							</p>
						</div>

						<button
							type="button"
							onClick={save}
							disabled={saving}
							className="inline-flex items-center justify-center gap-2 bg-ds-accent px-6 py-2.5 text-sm font-extrabold tracking-wider text-ds-accent-fg transition-colors hover:bg-ds-accent-hover disabled:opacity-50"
						>
							<Save className="h-4 w-4" />
							{saving ? "SAVING..." : "SAVE_NOTIFICATIONS"}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
