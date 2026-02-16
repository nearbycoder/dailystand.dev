import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Terminal } from "lucide-react"

export const Route = createFileRoute("/auth/sign-up")({
	validateSearch: (search) => ({
		invitationId:
			typeof search.invitationId === "string"
				? search.invitationId
				: undefined,
		email: typeof search.email === "string" ? search.email : undefined,
	}),
	component: SignUp,
})

function SignUp() {
	const navigate = useNavigate()
	const search = Route.useSearch()
	const [name, setName] = useState("")
	const [email, setEmail] = useState(search.email ?? "")
	const [password, setPassword] = useState("")
	const [error, setError] = useState("")
	const [loading, setLoading] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError("")
		setLoading(true)

		const result = await authClient.signUp.email({ name, email, password })

		if (result.error) {
			setError(result.error.message ?? "Sign up failed")
			setLoading(false)
			return
		}

		if (search.invitationId) {
			const inviteResult = await authClient.organization.acceptInvitation({
				invitationId: search.invitationId,
			})
			if (inviteResult.error) {
				setError(
					inviteResult.error.message ?? "Account created, but invite acceptance failed",
				)
				setLoading(false)
				return
			}
		}

		navigate({ to: "/app" })
	}

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
						CREATE_ACCOUNT
					</h1>
					<p className="text-sm text-ds-muted mb-8">
						// start running standups with your team
					</p>
					{search.invitationId && (
						<p className="mb-8 border border-ds-accent/50 bg-ds-accent/10 p-3 text-xs text-ds-accent">
							Invitation detected. Create an account with the invited email and
							we will accept the invite automatically.
						</p>
					)}

					<form onSubmit={handleSubmit} className="space-y-6">
						{error && (
							<div className="border-[3px] border-red-500 bg-red-500/10 p-3 text-red-400 text-sm font-bold">
								ERROR: {error}
							</div>
						)}
						<div>
							<label className="block text-xs font-bold tracking-widest text-ds-text-tertiary mb-2">
								NAME
							</label>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								placeholder="Jane Doe"
								className="w-full bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-3 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors placeholder:text-ds-muted2"
							/>
						</div>
						<div>
							<label className="block text-xs font-bold tracking-widest text-ds-text-tertiary mb-2">
								EMAIL
							</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								placeholder="you@company.com"
								className="w-full bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-3 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors placeholder:text-ds-muted2"
							/>
						</div>
						<div>
							<label className="block text-xs font-bold tracking-widest text-ds-text-tertiary mb-2">
								PASSWORD
							</label>
							<input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={8}
								placeholder="min 8 chars"
								className="w-full bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-3 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors placeholder:text-ds-muted2"
							/>
						</div>
						<button
							type="submit"
							disabled={loading}
							className="w-full bg-ds-accent text-ds-accent-fg py-3 font-extrabold text-sm tracking-wider hover:bg-ds-accent-hover transition-colors disabled:opacity-50"
						>
							{loading ? "CREATING..." : "CREATE_ACCOUNT →"}
						</button>
					</form>

					<p className="mt-6 text-sm text-ds-muted">
						Have an account?{" "}
						<Link
							to="/auth/sign-in"
							search={{
								invitationId: search.invitationId,
								email: search.email ?? email,
							}}
							className="text-ds-accent font-bold hover:underline"
						>
							[SIGN_IN]
						</Link>
					</p>
				</div>
			</div>
		</div>
	)
}
