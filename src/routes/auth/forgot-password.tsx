import { createFileRoute, Link } from "@tanstack/react-router";
import { Terminal } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth/forgot-password")({
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setLoading(true);
		setError("");
		setSuccess("");

		const redirectTo =
			typeof window === "undefined"
				? undefined
				: `${window.location.origin}/auth/reset-password`;

		const result = await authClient.requestPasswordReset({
			email,
			redirectTo,
		});

		if (result.error) {
			setError(result.error.message ?? "Unable to request password reset.");
			setLoading(false);
			return;
		}

		setSuccess(
			result.data?.message ??
				"If this email exists, a password reset link has been sent.",
		);
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
						FORGOT_PASSWORD
					</h1>
					<p className="text-sm text-ds-muted mb-8">
						// request a password reset link
					</p>

					<form onSubmit={handleSubmit} className="space-y-6">
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
							<label className="block text-xs font-bold tracking-widest text-ds-text-tertiary mb-2">
								EMAIL
							</label>
							<input
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								required
								placeholder="you@company.com"
								className="w-full bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-3 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors placeholder:text-ds-muted2"
							/>
						</div>
						<button
							type="submit"
							disabled={loading}
							className="w-full bg-ds-accent text-ds-accent-fg py-3 font-extrabold text-sm tracking-wider hover:bg-ds-accent-hover transition-colors disabled:opacity-50"
						>
							{loading ? "REQUESTING..." : "SEND_RESET_LINK →"}
						</button>
					</form>

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
