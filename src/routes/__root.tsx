import {
	HeadContent,
	Link,
	Outlet,
	Scripts,
	createRootRouteWithContext,
} from "@tanstack/react-router"

import Providers from "@/integrations/tanstack-query/root-provider"

import appCss from "../styles.css?url"

import type { QueryClient } from "@tanstack/react-query"
import type { TRPCRouter } from "@/integrations/trpc/router"
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query"

interface MyRouterContext {
	queryClient: QueryClient
	trpc: TRPCOptionsProxy<TRPCRouter>
}

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
				title: "DAILYSTAND // Async Standups",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
})

function NotFound() {
	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg font-mono flex items-center justify-center p-6 selection:bg-ds-selection-bg selection:text-ds-selection-fg">
			<div className="text-center">
				<h1 className="text-8xl font-extrabold tracking-tighter mb-4">404</h1>
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
		<html lang="en" className="dark">
			<head>
				<HeadContent />
			</head>
			<body className="bg-ds-bg text-ds-fg antialiased">
				<Providers>
					{children}
				</Providers>
				<Scripts />
			</body>
		</html>
	)
}
