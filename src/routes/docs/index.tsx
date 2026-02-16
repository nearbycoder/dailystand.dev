import { createFileRoute } from "@tanstack/react-router"
import { Copy, KeyRound, Rocket } from "lucide-react"
import { toast } from "sonner"
import { useDocsKey } from "@/components/docs/docs-key-context"
import { buildPageSeo } from "@/lib/seo"

const docsIndexSeo = buildPageSeo({
	title: "Standup API + MCP Quickstart | DailyStand Docs",
	description:
		"Quickstart guide for the DailyStand public API and MCP server. Authenticate with API keys and run your first standup automation calls.",
	path: "/docs",
	ogPage: "docs",
})

export const Route = createFileRoute("/docs/")({
	component: DocsQuickstartPage,
	head: () => ({ meta: docsIndexSeo.meta, links: docsIndexSeo.links }),
})

function DocsQuickstartPage() {
	const { apiKey, baseUrl } = useDocsKey()
	const key = apiKey.trim() || "YOUR_API_KEY"

	const quickCurl = `curl -s "${baseUrl}/api/public/v1/me" \\
  -H "x-api-key: ${key}"`

	const quickMcp = `curl -s -X POST "${baseUrl}/api/mcp" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${key}" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'`

	const copyBlock = async (value: string) => {
		try {
			await navigator.clipboard.writeText(value)
			toast.success("Copied snippet")
		} catch {
			toast.error("Clipboard unavailable")
		}
	}

	return (
		<div className="space-y-6">
			<section className="border-[3px] border-ds-border p-5 sm:p-6">
				<div className="mb-2 text-xs font-bold tracking-widest text-ds-accent">
					// QUICKSTART
				</div>
				<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
					PUBLIC API + MCP DOCUMENTATION
				</h1>
				<p className="mt-3 max-w-3xl text-sm leading-relaxed text-ds-text-tertiary">
					Use API keys to read teams, submit standups, export analytics, and
					control workflows with MCP tools. This docs area is public and lives
					outside the application shell.
				</p>
			</section>

			<section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
				<div className="border-[3px] border-ds-border p-5">
					<div className="mb-2 flex items-center gap-2 text-sm font-extrabold tracking-widest text-ds-accent">
						<KeyRound className="h-4 w-4" />
						AUTH MODEL
					</div>
					<ul className="space-y-2 text-xs text-ds-muted">
						<li>`x-api-key: ds_...` or `Authorization: Bearer ds_...`</li>
						<li>Scopes are `dailystand.*` permissions on your key.</li>
						<li>Org selection is optional for single-org users.</li>
						<li>Team reads/writes enforce membership and role checks.</li>
					</ul>
				</div>
				<div className="border-[3px] border-ds-border p-5">
					<div className="mb-2 flex items-center gap-2 text-sm font-extrabold tracking-widest text-cyan-400">
						<Rocket className="h-4 w-4" />
						REST BASE
					</div>
					<div className="break-all border-[2px] border-ds-border bg-ds-input-bg px-3 py-2 text-xs text-ds-fg">
						{baseUrl}/api/public/v1
					</div>
					<p className="mt-2 text-xs text-ds-muted">
						Docs metadata endpoint: `GET /api/public/v1`
					</p>
				</div>
				<div className="border-[3px] border-ds-border p-5">
					<div className="mb-2 flex items-center gap-2 text-sm font-extrabold tracking-widest text-yellow-400">
						<Rocket className="h-4 w-4" />
						MCP BASE
					</div>
					<div className="break-all border-[2px] border-ds-border bg-ds-input-bg px-3 py-2 text-xs text-ds-fg">
						{baseUrl}/api/mcp
					</div>
					<p className="mt-2 text-xs text-ds-muted">
						Transport: JSON-RPC 2.0 over HTTP POST
					</p>
				</div>
			</section>

			<section className="border-[3px] border-ds-border p-5 sm:p-6">
				<div className="mb-3 text-xs font-bold tracking-widest text-ds-accent">
					// 1) VERIFY YOUR KEY
				</div>
				<div className="relative">
					<button
						type="button"
						onClick={() => void copyBlock(quickCurl)}
						className="absolute right-3 top-3 inline-flex items-center gap-1 border-[2px] border-ds-border px-2 py-1 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
					>
						<Copy className="h-3 w-3" />
						COPY
					</button>
					<pre className="overflow-x-auto border-[2px] border-ds-border bg-ds-surface p-4 pr-4 text-[11px] leading-relaxed text-ds-fg sm:pr-20 sm:text-xs">
{quickCurl}
					</pre>
				</div>
			</section>

			<section className="border-[3px] border-ds-border p-5 sm:p-6">
				<div className="mb-3 text-xs font-bold tracking-widest text-ds-accent">
					// 2) LIST MCP TOOLS
				</div>
				<div className="relative">
					<button
						type="button"
						onClick={() => void copyBlock(quickMcp)}
						className="absolute right-3 top-3 inline-flex items-center gap-1 border-[2px] border-ds-border px-2 py-1 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
					>
						<Copy className="h-3 w-3" />
						COPY
					</button>
					<pre className="overflow-x-auto border-[2px] border-ds-border bg-ds-surface p-4 pr-4 text-[11px] leading-relaxed text-ds-fg sm:pr-20 sm:text-xs">
{quickMcp}
					</pre>
				</div>
			</section>
		</div>
	)
}
