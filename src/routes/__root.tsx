import {
	HeadContent,
	Link,
	Outlet,
	Scripts,
	createRootRouteWithContext,
} from "@tanstack/react-router"

import Providers from "@/integrations/tanstack-query/root-provider"
import { Toaster } from "@/components/ui/sonner"
import { SITE_NAME, buildOgImageUrl } from "@/lib/seo"

import appCss from "../styles.css?url"

import type { QueryClient } from "@tanstack/react-query"
import type { TRPCRouter } from "@/integrations/trpc/router"
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query"

interface MyRouterContext {
	queryClient: QueryClient
	trpc: TRPCOptionsProxy<TRPCRouter>
}

const defaultTitle = "DailyStand | Async Standup Software for Remote Teams"
const defaultDescription =
	"DailyStand is open source async standup software for remote engineering teams with analytics, API access, and MCP automation tools."
const defaultOgImage = buildOgImageUrl({
	page: "home",
	title: defaultTitle,
	subtitle: defaultDescription,
})

export const Route = createRootRouteWithContext<MyRouterContext>()({
	component: () => <Outlet />,
	notFoundComponent: NotFound,
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: defaultTitle,
			},
			{
				name: "description",
				content: defaultDescription,
			},
			{
				name: "robots",
				content: "index, follow, max-image-preview:large",
			},
			{
				property: "og:site_name",
				content: SITE_NAME,
			},
			{
				property: "og:type",
				content: "website",
			},
			{
				property: "og:title",
				content: defaultTitle,
			},
			{
				property: "og:description",
				content: defaultDescription,
			},
			{
				property: "og:image",
				content: defaultOgImage,
			},
			{
				name: "twitter:card",
				content: "summary_large_image",
			},
			{
				name: "twitter:title",
				content: defaultTitle,
			},
			{
				name: "twitter:description",
				content: defaultDescription,
			},
			{
				name: "twitter:image",
				content: defaultOgImage,
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg?v=2",
			},
			{
				rel: "icon",
				type: "image/x-icon",
				href: "/favicon.ico?v=2",
			},
		],
	}),
	shellComponent: RootDocument,
})

const themeBootScript = `(() => {
  try {
    const stored = localStorage.getItem("ds-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = stored === "dark" || stored === "light"
      ? stored
      : (prefersDark ? "dark" : "light");
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    html.classList.add(resolved);
  } catch (_) {}
})();`

function NotFound() {
	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg font-mono flex items-center justify-center p-4 sm:p-6 selection:bg-ds-selection-bg selection:text-ds-selection-fg">
			<div className="text-center">
				<h1 className="mb-4 text-6xl font-extrabold tracking-tighter sm:text-8xl">
					404
				</h1>
				<p className="text-ds-muted text-sm font-bold tracking-widest mb-8">
					// PAGE_NOT_FOUND
				</p>
				<Link to="/">
					<button className="bg-ds-accent text-ds-accent-fg px-8 py-3 font-extrabold text-sm tracking-wider hover:bg-ds-accent-hover transition-colors">
						GO_HOME &rarr;
					</button>
				</Link>
			</div>
		</div>
	)
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
				<HeadContent />
			</head>
			<body className="bg-ds-bg text-ds-fg antialiased">
				<Providers>
					{children}
					<Toaster
						position="top-right"
						expand
						richColors={false}
						closeButton
						duration={2200}
					/>
				</Providers>
				<Scripts />
			</body>
		</html>
	)
}
