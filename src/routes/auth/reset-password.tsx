import { createFileRoute, Link } from "@tanstack/react-router";
import { Terminal } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

const resetPasswordSearchSchema = z.object({
	token: z.string().optional(),
	error: z.string().optional(),
});

export const Route = createFileRoute("/auth/reset-password")({
	validateSearch: resetPasswordSearchSchema,
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const search = Route.useSearch();
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const token = search.token;
	const invalidToken =
		search.error?.toUpperCase() === "INVALID_TOKEN" || !search.token;

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!token) {
			setError("Reset token is missing or invalid.");
			return;
		}
		if (newPassword.length < 8) {
			setError("New password must be at least 8 characters.");
			return;
		}
		if (newPassword !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}

		setLoading(true);
		setError("");

		const result = await authClient.resetPassword({
			token,
			newPassword,
		});

		if (result.error) {
			setError(result.error.message ?? "Unable to reset password.");
			setLoading(false);
			return;
		}

		setSuccess(true);
		setLoading(false);
	};

	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg selection:bg-ds-selection-bg selection:text-ds-selection-fg font-mono flex items-center justify-center p-4 sm:p-6">
			<div className="w-full max-w-md">
				<div className="mb-8 flex items-center gap-3 sm:mb-10">
					<Terminal className="w-6 h-6 text-ds-accent" />
					<span className="text-xl font-extrabold tracking-tighter">
						DAILYSTAND
					</span>
				</div>

				<div className="border-[3px] border-ds-border-strong p-6 sm:p-8">
					<h1 className="text-2xl font-extrabold tracking-tighter mb-2">
						RESET_PASSWORD
					</h1>
					<p className="text-sm text-ds-muted mb-8">
						// set a new password for your account
					</p>

					{success ? (
						<div className="space-y-4">
							<div className="border-[3px] border-ds-accent bg-ds-accent/10 p-3 text-ds-accent text-sm font-bold">
								PASSWORD_UPDATED_SUCCESSFULLY
							</div>
							<Link
								to="/auth/sign-in"
								search={{ invitationId: undefined, email: undefined }}
								className="inline-block w-full bg-ds-accent text-ds-accent-fg py-3 text-center font-extrabold text-sm tracking-wider hover:bg-ds-accent-hover transition-colors"
							>
								SIGN_IN →
							</Link>
						</div>
					) : invalidToken ? (
						<div className="space-y-4">
							<div className="border-[3px] border-red-500 bg-red-500/10 p-3 text-red-400 text-sm font-bold">
								INVALID_OR_EXPIRED_RESET_LINK
							</div>
							<Link
								to="/auth/forgot-password"
								className="inline-block w-full border-[3px] border-ds-border-strong py-3 text-center font-extrabold text-sm tracking-wider hover:bg-ds-surface transition-colors"
							>
								REQUEST_NEW_LINK
							</Link>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="space-y-6">
							{error && (
								<div className="border-[3px] border-red-500 bg-red-500/10 p-3 text-red-400 text-sm font-bold">
									ERROR: {error}
								</div>
							)}
							<div>
								<label className="block text-xs font-bold tracking-widest text-ds-text-tertiary mb-2">
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
								<label className="block text-xs font-bold tracking-widest text-ds-text-tertiary mb-2">
									CONFIRM_PASSWORD
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
							<button
								type="submit"
								disabled={loading}
								className="w-full bg-ds-accent text-ds-accent-fg py-3 font-extrabold text-sm tracking-wider hover:bg-ds-accent-hover transition-colors disabled:opacity-50"
							>
								{loading ? "RESETTING..." : "RESET_PASSWORD →"}
							</button>
						</form>
					)}

					<p className="mt-6 text-sm text-ds-muted">
						Back to{" "}
						<Link
							to="/auth/sign-in"
							search={{ invitationId: undefined, email: undefined }}
							className="text-ds-accent font-bold hover:underline"
						>
							[SIGN_IN]
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
