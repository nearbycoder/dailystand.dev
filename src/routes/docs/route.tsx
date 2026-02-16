import { Link, Outlet, createFileRoute } from "@tanstack/react-router"
import { BookText, Eye, EyeOff, KeyRound, Terminal } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { DocsKeyProvider, useDocsKey } from "@/components/docs/docs-key-context"

export const Route = createFileRoute("/docs")({
	component: DocsRouteLayout,
})

const docsNavItems = [
	{
		to: "/docs" as const,
		label: "QUICKSTART",
		description: "Overview + auth",
	},
	{
		to: "/docs/rest" as const,
		label: "REST_API",
		description: "Endpoints + payloads",
	},
	{
		to: "/docs/mcp" as const,
		label: "MCP_SERVER",
		description: "JSON-RPC + tools",
	},
	{
		to: "/docs/explorer" as const,
		label: "API_EXPLORER",
		description: "Live test calls",
	},
]

function DocsRouteLayout() {
	return (
		<DocsKeyProvider>
			<DocsShell />
		</DocsKeyProvider>
	)
}

function DocsShell() {
	const { apiKey, setApiKey, showApiKey, setShowApiKey, baseUrl } = useDocsKey()

	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg font-mono selection:bg-ds-selection-bg selection:text-ds-selection-fg">
			<header className="border-b-[3px] border-ds-border-strong">
				<div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
					<div className="flex items-center gap-2">
						<Terminal className="h-5 w-5 text-ds-accent" />
						<span className="text-lg font-extrabold tracking-tighter">DOCS</span>
						<span className="hidden text-xs font-bold tracking-widest text-ds-muted2 sm:inline">
							// PUBLIC API + MCP
						</span>
					</div>
					<div className="ml-auto flex items-center gap-2">
						<Link
							to="/"
							className="border-[2px] border-ds-border px-2 py-1 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent sm:px-3"
						>
							HOME
						</Link>
						<Link
							to="/app"
							className="border-[2px] border-ds-border px-2 py-1 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent sm:px-3"
						>
							APP
						</Link>
						<ThemeToggle />
					</div>
				</div>
				<div className="mx-auto w-full max-w-[1500px] border-t-[3px] border-ds-border px-4 py-3 sm:px-6">
					<div className="grid grid-cols-1 gap-2 lg:grid-cols-[220px_minmax(0,1fr)_auto_auto] lg:items-center">
						<div className="text-[10px] font-bold tracking-widest text-ds-muted2">
							// REQUEST AUTH CONTEXT
						</div>
						<div className="flex min-w-0 items-stretch">
							<div className="flex w-full min-w-0 items-center border-[3px] border-ds-muted3 bg-ds-input-bg">
								<KeyRound className="ml-3 h-4 w-4 shrink-0 text-ds-accent" />
								<input
									type={showApiKey ? "text" : "password"}
									value={apiKey}
									onChange={(event) => setApiKey(event.target.value)}
									placeholder="ds_... paste API key for live calls"
									className="h-full min-w-0 flex-1 bg-transparent px-3 py-2 text-xs text-ds-fg placeholder:text-ds-muted2 focus:outline-none sm:text-sm"
								/>
								<button
									type="button"
									onClick={() => setShowApiKey(!showApiKey)}
									className="mr-2 inline-flex h-7 w-7 items-center justify-center text-ds-muted transition-colors hover:text-ds-accent"
									title={showApiKey ? "Hide API key" : "Show API key"}
								>
									{showApiKey ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>
						<button
							type="button"
							onClick={() => setApiKey("")}
							className="border-[3px] border-ds-border bg-transparent px-3 py-2 text-xs font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
						>
							CLEAR_KEY
						</button>
						<div className="truncate text-[10px] font-bold tracking-widest text-ds-muted2 sm:text-right">
							BASE: {baseUrl}/api/public/v1
						</div>
					</div>
				</div>
			</header>

			<div className="mx-auto grid w-full max-w-[1500px] gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
				<aside className="border-b-[3px] border-ds-border-strong lg:min-h-[calc(100vh-158px)] lg:border-b-0 lg:border-r-[3px]">
					<div className="hidden border-b-[3px] border-ds-border px-4 py-4 lg:block">
						<div className="mb-2 flex items-center gap-2 text-sm font-extrabold tracking-wider">
							<BookText className="h-4 w-4 text-ds-accent" />
							DOCS_NAV
						</div>
						<p className="text-xs text-ds-muted">
							Traditional API docs flow with live explorer support.
						</p>
					</div>
					<nav className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-0 lg:overflow-visible lg:p-4">
						{docsNavItems.map((item) => (
							<Link
								key={item.to}
								to={item.to}
								className="block min-w-[175px] shrink-0 border-[3px] border-ds-border p-3 transition-colors hover:border-ds-accent hover:bg-ds-accent/5 lg:mb-2 lg:min-w-0"
								activeProps={{
									className:
										"block min-w-[175px] shrink-0 border-[3px] border-ds-accent bg-ds-accent/10 p-3 lg:mb-2 lg:min-w-0",
								}}
							>
								<div className="text-xs font-extrabold tracking-widest">{item.label}</div>
								<div className="mt-1 text-[10px] font-bold tracking-widest text-ds-muted2">
									{item.description}
								</div>
							</Link>
						))}
					</nav>
				</aside>
				<main className="min-w-0 px-3 py-4 sm:px-6 sm:py-6">
					<Outlet />
				</main>
			</div>
		</div>
	)
}
