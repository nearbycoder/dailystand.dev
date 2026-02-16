import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/app/settings/security")({
	component: SecuritySettingsPage,
});

function SecuritySettingsPage() {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError("");
		setSuccess("");

		if (newPassword.length < 8) {
			setError("New password must be at least 8 characters.");
			return;
		}
		if (newPassword !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}

		setLoading(true);
		const result = await authClient.changePassword({
			currentPassword,
			newPassword,
			revokeOtherSessions,
		});

		if (result.error) {
			setError(result.error.message ?? "Unable to update password.");
			setLoading(false);
			return;
		}

		setSuccess("Password updated successfully.");
		setCurrentPassword("");
		setNewPassword("");
		setConfirmPassword("");
		setLoading(false);
	};

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			<div className="mb-8">
				<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
					SECURITY
				</h1>
				<p className="text-ds-muted text-sm mt-1">
					// UPDATE ACCOUNT PASSWORD
				</p>
			</div>

			<div className="border-[3px] border-ds-border p-4 sm:p-6">
				<div className="mb-4 flex items-center gap-2">
					<ShieldCheck className="h-4 w-4 text-ds-accent" />
					<span className="text-sm font-extrabold tracking-widest text-ds-accent">
						CHANGE_PASSWORD
					</span>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<div className="border-[3px] border-red-500 bg-red-500/10 p-3 text-red-400 text-sm font-bold">
							ERROR: {error}
						</div>
					)}
					{success && (
						<div className="border-[3px] border-ds-accent bg-ds-accent/10 p-3 text-ds-accent text-sm font-bold">
							{success}
						</div>
					)}

					<div>
						<label className="mb-2 block text-xs font-bold tracking-widest text-ds-text-tertiary">
							CURRENT_PASSWORD
						</label>
						<input
							type="password"
							value={currentPassword}
							onChange={(event) => setCurrentPassword(event.target.value)}
							required
							className="w-full bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-3 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors"
						/>
					</div>

					<div>
						<label className="mb-2 block text-xs font-bold tracking-widest text-ds-text-tertiary">
							NEW_PASSWORD
						</label>
						<input
							type="password"
							value={newPassword}
							onChange={(event) => setNewPassword(event.target.value)}
							required
							minLength={8}
							placeholder="min 8 chars"
							className="w-full bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-3 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors placeholder:text-ds-muted2"
						/>
					</div>

					<div>
						<label className="mb-2 block text-xs font-bold tracking-widest text-ds-text-tertiary">
							CONFIRM_NEW_PASSWORD
						</label>
						<input
							type="password"
							value={confirmPassword}
							onChange={(event) => setConfirmPassword(event.target.value)}
							required
							minLength={8}
							className="w-full bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-3 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors"
						/>
					</div>

					<label className="flex items-center gap-2 text-xs font-bold tracking-wider text-ds-muted">
						<input
							type="checkbox"
							checked={revokeOtherSessions}
							onChange={(event) =>
								setRevokeOtherSessions(event.target.checked)
							}
							className="h-3.5 w-3.5 accent-ds-accent"
						/>
						REVOKE_OTHER_SESSIONS
					</label>

					<button
						type="submit"
						disabled={loading}
						className="inline-flex w-full items-center justify-center gap-2 bg-ds-accent px-6 py-3 text-sm font-extrabold tracking-wider text-ds-accent-fg transition-colors hover:bg-ds-accent-hover disabled:opacity-50 sm:w-auto"
					>
						<LockKeyhole className="h-4 w-4" />
						{loading ? "UPDATING..." : "UPDATE_PASSWORD"}
					</button>
				</form>
			</div>
		</div>
	);
}
