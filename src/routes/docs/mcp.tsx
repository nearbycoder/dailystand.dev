import { createFileRoute } from "@tanstack/react-router"
import { Copy, Server, Wrench } from "lucide-react"
import { toast } from "sonner"
import { useDocsKey } from "@/components/docs/docs-key-context"
import { MCP_METHODS, MCP_TOOLS } from "@/lib/docs-content"
import { buildPageSeo } from "@/lib/seo"

const docsMcpSeo = buildPageSeo({
	title: "MCP Server Docs | DailyStand",
	description:
		"Learn how to use the DailyStand MCP server over JSON-RPC, including tools/list and tools/call flows for standup automation.",
	path: "/docs/mcp",
	ogPage: "docs",
})

export const Route = createFileRoute("/docs/mcp")({
	component: DocsMcpPage,
	head: () => ({ meta: docsMcpSeo.meta, links: docsMcpSeo.links }),
})

function DocsMcpPage() {
	const { apiKey, baseUrl } = useDocsKey()
	const key = apiKey.trim() || "YOUR_API_KEY"

	const copySnippet = async (value: string) => {
		try {
			await navigator.clipboard.writeText(value)
			toast.success("Snippet copied")
		} catch {
			toast.error("Clipboard unavailable")
		}
	}

	return (
		<div className="space-y-6">
			<section className="border-[3px] border-ds-border p-5 sm:p-6">
				<div className="mb-2 text-xs font-bold tracking-widest text-ds-accent">
					// MCP SERVER
				</div>
				<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
					JSON-RPC TOOLING FOR AGENTS
				</h1>
				<p className="mt-3 max-w-3xl text-sm leading-relaxed text-ds-text-tertiary">
					The MCP endpoint exposes DailyStand tools over JSON-RPC 2.0. Use
					`initialize`, `tools/list`, then `tools/call`.
				</p>
			</section>

			<section className="border-[3px] border-ds-border p-4 sm:p-5">
				<div className="mb-3 flex items-center gap-2 text-sm font-extrabold tracking-widest text-ds-accent">
					<Server className="h-4 w-4" />
					TRANSPORT
				</div>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<div className="border-[2px] border-ds-border p-3">
						<div className="text-[10px] font-bold tracking-widest text-ds-muted2">
							ENDPOINT
						</div>
						<div className="mt-1 break-all text-xs font-bold">{baseUrl}/api/mcp</div>
					</div>
					<div className="border-[2px] border-ds-border p-3">
						<div className="text-[10px] font-bold tracking-widest text-ds-muted2">
							PROTOCOL
						</div>
						<div className="mt-1 text-xs font-bold">JSON-RPC 2.0</div>
					</div>
					<div className="border-[2px] border-ds-border p-3">
						<div className="text-[10px] font-bold tracking-widest text-ds-muted2">
							AUTH
						</div>
						<div className="mt-1 text-xs font-bold">x-api-key header</div>
					</div>
					<div className="border-[2px] border-ds-border p-3">
						<div className="text-[10px] font-bold tracking-widest text-ds-muted2">
							KEY STATUS
						</div>
						<div className="mt-1 truncate text-xs font-bold">
							{key === "YOUR_API_KEY" ? "NOT_SET" : "READY"}
						</div>
					</div>
				</div>
			</section>

			<div className="space-y-4">
				{MCP_METHODS.map((methodDoc) => {
					const payload = methodDoc.payloadExample.replaceAll("YOUR_API_KEY", key)
					const curl = `curl -s -X POST "${baseUrl}/api/mcp" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${key}" \\
  -d '${payload}'`
					return (
						<section
							key={methodDoc.id}
							className="border-[3px] border-ds-border p-4 sm:p-5"
						>
							<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
								<div>
									<div className="text-sm font-extrabold tracking-wider">
										{methodDoc.label}
									</div>
									<div className="mt-1 text-xs text-ds-muted">
										{methodDoc.description}
									</div>
								</div>
								<div className="border-[2px] border-cyan-400/60 px-2 py-1 text-[10px] font-extrabold tracking-widest text-cyan-400">
									{methodDoc.method}
								</div>
							</div>
							<ul className="mb-3 space-y-1 text-xs text-ds-muted">
								{methodDoc.notes.map((note) => (
									<li key={note}>{note}</li>
								))}
							</ul>
							<div className="relative">
								<button
									type="button"
									onClick={() => void copySnippet(curl)}
									className="absolute right-3 top-3 inline-flex items-center gap-1 border-[2px] border-ds-border px-2 py-1 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
								>
									<Copy className="h-3 w-3" />
									COPY
								</button>
								<pre className="overflow-x-auto border-[2px] border-ds-border bg-ds-surface p-4 pr-4 text-[11px] leading-relaxed text-ds-fg sm:pr-20 sm:text-xs">
{curl}
								</pre>
							</div>
						</section>
					)
				})}
			</div>

			<section className="border-[3px] border-ds-border p-4 sm:p-5">
				<div className="mb-3 flex items-center gap-2 text-sm font-extrabold tracking-widest text-ds-accent">
					<Wrench className="h-4 w-4" />
					TOOL CATALOG
				</div>
				<div className="space-y-2 md:hidden">
					{MCP_TOOLS.map((tool) => (
						<div key={tool.name} className="border-[2px] border-ds-border p-3">
							<div className="text-xs font-extrabold text-ds-fg">{tool.name}</div>
							<div className="mt-1 text-[10px] font-bold tracking-widest text-ds-muted2">
								{tool.access === "owner_or_admin" ? "OWNER/ADMIN" : "MEMBER"} //{" "}
								{tool.requiredScope}
							</div>
							<div className="mt-2 text-xs text-ds-muted">{tool.description}</div>
						</div>
					))}
				</div>
				<div className="hidden overflow-x-auto border-[2px] border-ds-border md:block">
					<table className="min-w-full border-collapse text-xs">
						<thead>
							<tr className="border-b-[2px] border-ds-border bg-ds-surface">
								<th className="px-3 py-2 text-left font-extrabold tracking-widest">
									TOOL
								</th>
								<th className="px-3 py-2 text-left font-extrabold tracking-widest">
									ACCESS
								</th>
								<th className="px-3 py-2 text-left font-extrabold tracking-widest">
									SCOPE
								</th>
								<th className="px-3 py-2 text-left font-extrabold tracking-widest">
									DESCRIPTION
								</th>
							</tr>
						</thead>
						<tbody>
							{MCP_TOOLS.map((tool) => (
								<tr key={tool.name} className="border-b border-ds-border">
									<td className="px-3 py-2 font-bold text-ds-fg">{tool.name}</td>
									<td className="px-3 py-2 text-ds-muted">
										{tool.access === "owner_or_admin"
											? "OWNER/ADMIN"
											: "MEMBER"}
									</td>
									<td className="px-3 py-2 text-ds-muted">{tool.requiredScope}</td>
									<td className="px-3 py-2 text-ds-muted">{tool.description}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	)
}
