import { createFileRoute } from "@tanstack/react-router"
import { ChevronDown, Copy, Play, TerminalSquare } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useDocsKey } from "@/components/docs/docs-key-context"
import { MCP_TOOLS, REST_ENDPOINTS } from "@/lib/docs-content"
import { buildPageSeo } from "@/lib/seo"

const docsExplorerSeo = buildPageSeo({
	title: "API Explorer | DailyStand Docs",
	description:
		"Run live REST and MCP calls from the DailyStand docs explorer to validate API keys, scopes, and standup automation payloads.",
	path: "/docs/explorer",
	ogPage: "docs",
})

export const Route = createFileRoute("/docs/explorer")({
	component: DocsExplorerPage,
	head: () => ({ meta: docsExplorerSeo.meta, links: docsExplorerSeo.links }),
})

type ResponseState = {
	status: number
	ok: boolean
	elapsedMs: number
	body: string
}

function DocsExplorerPage() {
	const { apiKey, baseUrl } = useDocsKey()
	const [mode, setMode] = useState<"rest" | "mcp">("rest")

	const [restEndpointId, setRestEndpointId] = useState(REST_ENDPOINTS[0]?.id ?? "")
	const [restQuery, setRestQuery] = useState("")
	const [restBody, setRestBody] = useState("{}")
	const [restLoading, setRestLoading] = useState(false)
	const [restResponse, setRestResponse] = useState<ResponseState | null>(null)

	const [mcpMethod, setMcpMethod] = useState<"initialize" | "tools/list" | "tools/call">(
		"initialize",
	)
	const [mcpToolName, setMcpToolName] = useState(MCP_TOOLS[0]?.name ?? "")
	const [mcpToolArgs, setMcpToolArgs] = useState("{}")
	const [mcpLoading, setMcpLoading] = useState(false)
	const [mcpResponse, setMcpResponse] = useState<ResponseState | null>(null)

	const activeRestEndpoint = useMemo(
		() => REST_ENDPOINTS.find((endpoint) => endpoint.id === restEndpointId),
		[restEndpointId],
	)

	useEffect(() => {
		if (!activeRestEndpoint) return
		setRestQuery(activeRestEndpoint.queryHint ?? "")
		setRestBody(activeRestEndpoint.bodyExample ?? "{}")
	}, [activeRestEndpoint])

	const copyText = async (value: string) => {
		try {
			await navigator.clipboard.writeText(value)
			toast.success("Copied")
		} catch {
			toast.error("Clipboard unavailable")
		}
	}

	const runRest = async () => {
		if (!activeRestEndpoint) return
		const headers: HeadersInit = {}
		if (apiKey.trim()) headers["x-api-key"] = apiKey.trim()

		const url = new URL(activeRestEndpoint.path, baseUrl)
		if (restQuery.trim()) {
			const query = restQuery.trim().startsWith("?")
				? restQuery.trim().slice(1)
				: restQuery.trim()
			url.search = query
		}

		const init: RequestInit = { method: activeRestEndpoint.method, headers }
		if (activeRestEndpoint.method === "POST") {
			headers["Content-Type"] = "application/json"
			try {
				const parsed = JSON.parse(restBody)
				init.body = JSON.stringify(parsed)
			} catch {
				toast.error("Body must be valid JSON")
				return
			}
		}

		setRestLoading(true)
		const start = performance.now()
		try {
			const response = await fetch(url.toString(), init)
			const rawText = await response.text()
			let formatted = rawText
			try {
				formatted = JSON.stringify(JSON.parse(rawText), null, 2)
			} catch {
				// keep raw text fallback
			}
			setRestResponse({
				status: response.status,
				ok: response.ok,
				elapsedMs: Math.round(performance.now() - start),
				body: formatted || "<empty>",
			})
		} catch (error) {
			setRestResponse({
				status: 0,
				ok: false,
				elapsedMs: Math.round(performance.now() - start),
				body:
					error instanceof Error ? error.message : "Unable to complete request.",
			})
		} finally {
			setRestLoading(false)
		}
	}

	const runMcp = async () => {
		const headers: HeadersInit = { "Content-Type": "application/json" }
		if (apiKey.trim()) headers["x-api-key"] = apiKey.trim()

		let params: Record<string, unknown> = {}
		if (mcpMethod === "tools/call") {
			let parsedArgs: Record<string, unknown> = {}
			try {
				parsedArgs = JSON.parse(mcpToolArgs)
			} catch {
				toast.error("Tool args must be valid JSON")
				return
			}
			params = {
				name: mcpToolName,
				arguments: parsedArgs,
			}
		}

		const payload = {
			jsonrpc: "2.0",
			id: Date.now(),
			method: mcpMethod,
			params,
		}

		setMcpLoading(true)
		const start = performance.now()
		try {
			const response = await fetch(`${baseUrl}/api/mcp`, {
				method: "POST",
				headers,
				body: JSON.stringify(payload),
			})
			const rawText = await response.text()
			let formatted = rawText
			try {
				formatted = JSON.stringify(JSON.parse(rawText), null, 2)
			} catch {
				// keep raw text fallback
			}
			setMcpResponse({
				status: response.status,
				ok: response.ok,
				elapsedMs: Math.round(performance.now() - start),
				body: formatted || "<empty>",
			})
		} catch (error) {
			setMcpResponse({
				status: 0,
				ok: false,
				elapsedMs: Math.round(performance.now() - start),
				body:
					error instanceof Error ? error.message : "Unable to complete request.",
			})
		} finally {
			setMcpLoading(false)
		}
	}

	return (
		<div className="space-y-6">
			<section className="border-[3px] border-ds-border p-5 sm:p-6">
				<div className="mb-2 text-xs font-bold tracking-widest text-ds-accent">
					// API EXPLORER
				</div>
				<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
					TEST CALLS DIRECTLY FROM DOCS
				</h1>
				<p className="mt-3 max-w-3xl text-sm leading-relaxed text-ds-text-tertiary">
					Use the API key in the header to run live REST and MCP calls. This is
					ideal for validating scopes and quickly testing payloads.
				</p>
			</section>

			<section className="border-[3px] border-ds-border p-4 sm:p-5">
				<div className="mb-4 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => setMode("rest")}
						className={`border-[3px] px-3 py-2 text-xs font-extrabold tracking-widest ${
							mode === "rest"
								? "border-ds-accent bg-ds-accent/10 text-ds-accent"
								: "border-ds-border text-ds-text-tertiary hover:border-ds-accent hover:text-ds-accent"
						}`}
					>
						REST
					</button>
					<button
						type="button"
						onClick={() => setMode("mcp")}
						className={`border-[3px] px-3 py-2 text-xs font-extrabold tracking-widest ${
							mode === "mcp"
								? "border-ds-accent bg-ds-accent/10 text-ds-accent"
								: "border-ds-border text-ds-text-tertiary hover:border-ds-accent hover:text-ds-accent"
						}`}
					>
						MCP
					</button>
				</div>

				{mode === "rest" ? (
					<div className="space-y-4">
						<div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr]">
								<div>
									<label className="mb-2 block text-[10px] font-bold tracking-widest text-ds-muted2">
										ENDPOINT
									</label>
									<div className="relative">
										<select
											value={restEndpointId}
											onChange={(event) => setRestEndpointId(event.target.value)}
											className="w-full appearance-none border-[3px] border-ds-muted3 bg-ds-input-bg px-3 py-2 pr-10 text-xs font-bold text-ds-fg focus:border-ds-accent focus:outline-none sm:text-sm"
										>
											{REST_ENDPOINTS.map((endpoint) => (
												<option key={endpoint.id} value={endpoint.id}>
													[{endpoint.method}] {endpoint.path}
												</option>
											))}
										</select>
										<span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ds-text-tertiary">
											<ChevronDown className="h-4 w-4" />
										</span>
									</div>
								</div>
							<div>
								<label className="mb-2 block text-[10px] font-bold tracking-widest text-ds-muted2">
									QUERY STRING
								</label>
								<input
									value={restQuery}
									onChange={(event) => setRestQuery(event.target.value)}
									placeholder="orgId=...&teamId=..."
									className="w-full border-[3px] border-ds-muted3 bg-ds-input-bg px-3 py-2 text-xs text-ds-fg focus:border-ds-accent focus:outline-none sm:text-sm"
								/>
							</div>
						</div>
						{activeRestEndpoint?.method === "POST" && (
							<div>
								<label className="mb-2 block text-[10px] font-bold tracking-widest text-ds-muted2">
									JSON BODY
								</label>
								<textarea
									value={restBody}
									onChange={(event) => setRestBody(event.target.value)}
									rows={10}
									className="w-full border-[3px] border-ds-muted3 bg-ds-input-bg px-3 py-2 text-xs text-ds-fg focus:border-ds-accent focus:outline-none"
								/>
							</div>
						)}
						<div className="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={() => void runRest()}
								disabled={restLoading}
								className="inline-flex items-center gap-2 bg-ds-accent px-4 py-2 text-xs font-extrabold tracking-widest text-ds-accent-fg transition-colors hover:bg-ds-accent-hover disabled:opacity-50"
							>
								<Play className="h-3.5 w-3.5" />
								{restLoading ? "RUNNING..." : "SEND_REST"}
							</button>
							{restResponse && (
								<span className="text-xs font-bold text-ds-muted">
									STATUS {restResponse.status} // {restResponse.elapsedMs}ms
								</span>
							)}
						</div>
						{restResponse && (
							<div className="relative">
								<button
									type="button"
									onClick={() => void copyText(restResponse.body)}
									className="absolute right-3 top-3 inline-flex items-center gap-1 border-[2px] border-ds-border px-2 py-1 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
								>
									<Copy className="h-3 w-3" />
									COPY
								</button>
								<pre className="max-h-[420px] overflow-auto border-[2px] border-ds-border bg-ds-surface p-4 pr-4 text-[11px] leading-relaxed text-ds-fg sm:pr-20 sm:text-xs">
{restResponse.body}
								</pre>
							</div>
						)}
					</div>
				) : (
					<div className="space-y-4">
						<div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr]">
								<div>
									<label className="mb-2 block text-[10px] font-bold tracking-widest text-ds-muted2">
										METHOD
									</label>
									<div className="relative">
										<select
											value={mcpMethod}
											onChange={(event) =>
												setMcpMethod(
													event.target.value as
														| "initialize"
														| "tools/list"
														| "tools/call",
												)
											}
											className="w-full appearance-none border-[3px] border-ds-muted3 bg-ds-input-bg px-3 py-2 pr-10 text-xs font-bold text-ds-fg focus:border-ds-accent focus:outline-none sm:text-sm"
										>
											<option value="initialize">initialize</option>
											<option value="tools/list">tools/list</option>
											<option value="tools/call">tools/call</option>
										</select>
										<span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ds-text-tertiary">
											<ChevronDown className="h-4 w-4" />
										</span>
									</div>
								</div>
							<div>
								<label className="mb-2 block text-[10px] font-bold tracking-widest text-ds-muted2">
									ENDPOINT
								</label>
								<input
									disabled
									value={`${baseUrl}/api/mcp`}
									className="w-full border-[3px] border-ds-muted3 bg-ds-input-bg px-3 py-2 text-xs text-ds-muted focus:outline-none sm:text-sm"
								/>
							</div>
						</div>
						{mcpMethod === "tools/call" && (
							<div className="grid grid-cols-1 gap-3 lg:grid-cols-[300px_1fr]">
									<div>
										<label className="mb-2 block text-[10px] font-bold tracking-widest text-ds-muted2">
											TOOL NAME
										</label>
										<div className="relative">
											<select
												value={mcpToolName}
												onChange={(event) => setMcpToolName(event.target.value)}
												className="w-full appearance-none border-[3px] border-ds-muted3 bg-ds-input-bg px-3 py-2 pr-10 text-xs font-bold text-ds-fg focus:border-ds-accent focus:outline-none sm:text-sm"
											>
												{MCP_TOOLS.map((tool) => (
													<option key={tool.name} value={tool.name}>
														{tool.name}
													</option>
												))}
											</select>
											<span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ds-text-tertiary">
												<ChevronDown className="h-4 w-4" />
											</span>
										</div>
									</div>
								<div>
									<label className="mb-2 block text-[10px] font-bold tracking-widest text-ds-muted2">
										TOOL ARGUMENTS (JSON)
									</label>
									<textarea
										value={mcpToolArgs}
										onChange={(event) => setMcpToolArgs(event.target.value)}
										rows={6}
										className="w-full border-[3px] border-ds-muted3 bg-ds-input-bg px-3 py-2 text-xs text-ds-fg focus:border-ds-accent focus:outline-none"
									/>
								</div>
							</div>
						)}
						<div className="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={() => void runMcp()}
								disabled={mcpLoading}
								className="inline-flex items-center gap-2 bg-ds-accent px-4 py-2 text-xs font-extrabold tracking-widest text-ds-accent-fg transition-colors hover:bg-ds-accent-hover disabled:opacity-50"
							>
								<TerminalSquare className="h-3.5 w-3.5" />
								{mcpLoading ? "RUNNING..." : "SEND_MCP"}
							</button>
							{mcpResponse && (
								<span className="text-xs font-bold text-ds-muted">
									STATUS {mcpResponse.status} // {mcpResponse.elapsedMs}ms
								</span>
							)}
						</div>
						{mcpResponse && (
							<div className="relative">
								<button
									type="button"
									onClick={() => void copyText(mcpResponse.body)}
									className="absolute right-3 top-3 inline-flex items-center gap-1 border-[2px] border-ds-border px-2 py-1 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
								>
									<Copy className="h-3 w-3" />
									COPY
								</button>
								<pre className="max-h-[420px] overflow-auto border-[2px] border-ds-border bg-ds-surface p-4 pr-4 text-[11px] leading-relaxed text-ds-fg sm:pr-20 sm:text-xs">
{mcpResponse.body}
								</pre>
							</div>
						)}
					</div>
				)}
			</section>
		</div>
	)
}
