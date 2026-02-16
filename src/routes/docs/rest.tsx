import { createFileRoute } from "@tanstack/react-router"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { useDocsKey } from "@/components/docs/docs-key-context"
import { REST_ENDPOINTS, type RestEndpointDoc } from "@/lib/docs-content"

export const Route = createFileRoute("/docs/rest")({
	component: DocsRestPage,
})

function buildCurlSnippet(
	endpoint: RestEndpointDoc,
	baseUrl: string,
	key: string,
): string {
	const query = endpoint.queryHint ? `?${endpoint.queryHint}` : ""
	if (endpoint.method === "GET") {
		return `curl -s "${baseUrl}${endpoint.path}${query}" \\
  -H "x-api-key: ${key}"`
	}

	const body = endpoint.bodyExample ?? "{}"
	return `curl -s -X POST "${baseUrl}${endpoint.path}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${key}" \\
  -d '${body}'`
}

function DocsRestPage() {
	const { apiKey, baseUrl } = useDocsKey()
	const key = apiKey.trim() || "YOUR_API_KEY"

	const copySnippet = async (snippet: string) => {
		try {
			await navigator.clipboard.writeText(snippet)
			toast.success("cURL copied")
		} catch {
			toast.error("Clipboard unavailable")
		}
	}

	return (
		<div className="space-y-6">
			<section className="border-[3px] border-ds-border p-5 sm:p-6">
				<div className="mb-2 text-xs font-bold tracking-widest text-ds-accent">
					// REST API
				</div>
				<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
					ENDPOINT REFERENCE
				</h1>
				<p className="mt-3 max-w-3xl text-sm leading-relaxed text-ds-text-tertiary">
					All endpoints are under <code>{baseUrl}/api/public/v1</code>. Use API
					keys with granular scopes to authenticate each request.
				</p>
			</section>

			<section className="border-[3px] border-ds-border p-4 sm:p-5">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<div className="border-[2px] border-ds-border p-3">
						<div className="text-[10px] font-bold tracking-widest text-ds-muted2">
							AUTH HEADER
						</div>
						<div className="mt-1 text-xs font-bold">x-api-key: ds_...</div>
					</div>
					<div className="border-[2px] border-ds-border p-3">
						<div className="text-[10px] font-bold tracking-widest text-ds-muted2">
							SUPPORTED METHODS
						</div>
						<div className="mt-1 text-xs font-bold">GET, POST, OPTIONS</div>
					</div>
					<div className="border-[2px] border-ds-border p-3">
						<div className="text-[10px] font-bold tracking-widest text-ds-muted2">
							VERSION
						</div>
						<div className="mt-1 text-xs font-bold">v1</div>
					</div>
					<div className="border-[2px] border-ds-border p-3">
						<div className="text-[10px] font-bold tracking-widest text-ds-muted2">
							FORMAT
						</div>
						<div className="mt-1 text-xs font-bold">JSON</div>
					</div>
				</div>
			</section>

			<div className="space-y-4">
				{REST_ENDPOINTS.map((endpoint) => {
					const snippet = buildCurlSnippet(endpoint, baseUrl, key)
					return (
						<section
							key={endpoint.id}
							className="border-[3px] border-ds-border p-4 sm:p-5"
						>
							<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
								<div>
									<div className="text-sm font-extrabold tracking-wider">
										{endpoint.label}
									</div>
									<div className="mt-1 text-xs text-ds-muted">
										{endpoint.description}
									</div>
								</div>
								<div className="flex items-center gap-2">
									<span
										className={`border-[2px] px-2 py-1 text-[10px] font-extrabold tracking-widest ${
											endpoint.method === "GET"
												? "border-cyan-400/60 text-cyan-400"
												: "border-lime-400/70 text-lime-400"
										}`}
									>
										{endpoint.method}
									</span>
									<span className="border-[2px] border-ds-border px-2 py-1 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary">
										{endpoint.scope}
									</span>
								</div>
							</div>

							<div className="mb-3 overflow-x-auto border-[2px] border-ds-border bg-ds-input-bg px-3 py-2 text-xs font-bold text-ds-fg">
								{endpoint.path}
								{endpoint.queryHint ? `?${endpoint.queryHint}` : ""}
							</div>

							<div className="relative">
								<button
									type="button"
									onClick={() => void copySnippet(snippet)}
									className="absolute right-3 top-3 inline-flex items-center gap-1 border-[2px] border-ds-border px-2 py-1 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
								>
									<Copy className="h-3 w-3" />
									COPY
								</button>
								<pre className="overflow-x-auto border-[2px] border-ds-border bg-ds-surface p-4 pr-4 text-[11px] leading-relaxed text-ds-fg sm:pr-20 sm:text-xs">
{snippet}
								</pre>
							</div>
						</section>
					)
				})}
			</div>
		</div>
	)
}
