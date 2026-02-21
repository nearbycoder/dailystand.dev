import { PostHogProvider } from "@posthog/react";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { Toaster } from "@/components/ui/sonner";
import Providers from "@/integrations/tanstack-query/root-provider";
import type { TRPCRouter } from "@/integrations/trpc/router";
import { absoluteUrl, buildOgImageUrl, SITE_NAME } from "@/lib/seo";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
	trpc: TRPCOptionsProxy<TRPCRouter>;
}

type RuntimePublicEnv = {
	VITE_PUBLIC_POSTHOG_KEY?: string;
	VITE_PUBLIC_POSTHOG_HOST?: string;
	VITE_PUBLIC_POSTHOG_UI_HOST?: string;
	VITE_PUBLIC_POSTHOG_ENABLE_IN_DEV?: string;
	VITE_PUBLIC_POSTHOG_DEBUG?: string;
	VITE_SENTRY_DSN?: string;
	VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
	VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE?: string;
	VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE?: string;
	VITE_SENTRY_SEND_DEFAULT_PII?: string;
	VITE_SENTRY_ENABLE_IN_DEV?: string;
};

declare global {
	interface Window {
		__DS_PUBLIC_ENV__?: RuntimePublicEnv;
	}
}

const defaultTitle = "DailyStand | Async Standup Software for Remote Teams";
const defaultDescription =
	"DailyStand is open source async standup software for remote engineering teams with analytics, API access, and MCP automation tools.";
const defaultOgUrl = absoluteUrl("/");
const defaultOgImage = buildOgImageUrl({
	page: "home",
	title: defaultTitle,
	subtitle: defaultDescription,
});

function readServerRuntimePublicEnv(): RuntimePublicEnv {
	const processEnv = typeof process !== "undefined" ? process.env : undefined;
	return {
		VITE_PUBLIC_POSTHOG_KEY: processEnv?.VITE_PUBLIC_POSTHOG_KEY,
		VITE_PUBLIC_POSTHOG_HOST: processEnv?.VITE_PUBLIC_POSTHOG_HOST,
		VITE_PUBLIC_POSTHOG_UI_HOST: processEnv?.VITE_PUBLIC_POSTHOG_UI_HOST,
		VITE_PUBLIC_POSTHOG_ENABLE_IN_DEV:
			processEnv?.VITE_PUBLIC_POSTHOG_ENABLE_IN_DEV,
		VITE_PUBLIC_POSTHOG_DEBUG: processEnv?.VITE_PUBLIC_POSTHOG_DEBUG,
		VITE_SENTRY_DSN: processEnv?.VITE_SENTRY_DSN,
		VITE_SENTRY_TRACES_SAMPLE_RATE: processEnv?.VITE_SENTRY_TRACES_SAMPLE_RATE,
		VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE:
			processEnv?.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
		VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE:
			processEnv?.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
		VITE_SENTRY_SEND_DEFAULT_PII: processEnv?.VITE_SENTRY_SEND_DEFAULT_PII,
		VITE_SENTRY_ENABLE_IN_DEV: processEnv?.VITE_SENTRY_ENABLE_IN_DEV,
	};
}

function readRuntimePublicEnv(): RuntimePublicEnv {
	const serverEnv = readServerRuntimePublicEnv();
	const clientEnv =
		typeof window !== "undefined" ? window.__DS_PUBLIC_ENV__ : undefined;
	return {
		VITE_PUBLIC_POSTHOG_KEY:
			clientEnv?.VITE_PUBLIC_POSTHOG_KEY ??
			serverEnv.VITE_PUBLIC_POSTHOG_KEY ??
			import.meta.env.VITE_PUBLIC_POSTHOG_KEY,
		VITE_PUBLIC_POSTHOG_HOST:
			clientEnv?.VITE_PUBLIC_POSTHOG_HOST ??
			serverEnv.VITE_PUBLIC_POSTHOG_HOST ??
			import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
		VITE_PUBLIC_POSTHOG_UI_HOST:
			clientEnv?.VITE_PUBLIC_POSTHOG_UI_HOST ??
			serverEnv.VITE_PUBLIC_POSTHOG_UI_HOST ??
			import.meta.env.VITE_PUBLIC_POSTHOG_UI_HOST,
		VITE_PUBLIC_POSTHOG_ENABLE_IN_DEV:
			clientEnv?.VITE_PUBLIC_POSTHOG_ENABLE_IN_DEV ??
			serverEnv.VITE_PUBLIC_POSTHOG_ENABLE_IN_DEV ??
			import.meta.env.VITE_PUBLIC_POSTHOG_ENABLE_IN_DEV,
		VITE_PUBLIC_POSTHOG_DEBUG:
			clientEnv?.VITE_PUBLIC_POSTHOG_DEBUG ??
			serverEnv.VITE_PUBLIC_POSTHOG_DEBUG ??
			import.meta.env.VITE_PUBLIC_POSTHOG_DEBUG,
		VITE_SENTRY_DSN:
			clientEnv?.VITE_SENTRY_DSN ??
			serverEnv.VITE_SENTRY_DSN ??
			import.meta.env.VITE_SENTRY_DSN,
		VITE_SENTRY_TRACES_SAMPLE_RATE:
			clientEnv?.VITE_SENTRY_TRACES_SAMPLE_RATE ??
			serverEnv.VITE_SENTRY_TRACES_SAMPLE_RATE ??
			import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
		VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE:
			clientEnv?.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ??
			serverEnv.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ??
			import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
		VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE:
			clientEnv?.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ??
			serverEnv.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ??
			import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
		VITE_SENTRY_SEND_DEFAULT_PII:
			clientEnv?.VITE_SENTRY_SEND_DEFAULT_PII ??
			serverEnv.VITE_SENTRY_SEND_DEFAULT_PII ??
			import.meta.env.VITE_SENTRY_SEND_DEFAULT_PII,
		VITE_SENTRY_ENABLE_IN_DEV:
			clientEnv?.VITE_SENTRY_ENABLE_IN_DEV ??
			serverEnv.VITE_SENTRY_ENABLE_IN_DEV ??
			import.meta.env.VITE_SENTRY_ENABLE_IN_DEV,
	};
}

function serializeInlineRuntimeEnv(env: RuntimePublicEnv) {
	return JSON.stringify(env).replace(/</g, "\\u003c");
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
				property: "og:url",
				content: defaultOgUrl,
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
});

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
})();`;

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
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	const runtimePublicEnv = readRuntimePublicEnv();
	const runtimePublicEnvScript = `window.__DS_PUBLIC_ENV__ = ${serializeInlineRuntimeEnv(runtimePublicEnv)};`;
	const posthogRuntimeEnv = runtimePublicEnv;
	const posthogApiKey = posthogRuntimeEnv.VITE_PUBLIC_POSTHOG_KEY;
	const posthogApiHost =
		posthogRuntimeEnv.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
	const posthogUiHost =
		posthogRuntimeEnv.VITE_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com";
	const posthogEnabledInDev =
		posthogRuntimeEnv.VITE_PUBLIC_POSTHOG_ENABLE_IN_DEV === "true";
	const shouldEnablePosthog =
		Boolean(posthogApiKey) && (import.meta.env.PROD || posthogEnabledInDev);

	const app = (
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
	);

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: runtimePublicEnvScript }} />
				<script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
				<HeadContent />
			</head>
			<body className="bg-ds-bg text-ds-fg antialiased">
				{shouldEnablePosthog ? (
					<PostHogProvider
						apiKey={posthogApiKey!}
						options={{
							api_host: posthogApiHost,
							ui_host: posthogUiHost,
							defaults: "2025-05-24",
							capture_exceptions: true,
							debug: posthogRuntimeEnv.VITE_PUBLIC_POSTHOG_DEBUG === "true",
						}}
					>
						{app}
					</PostHogProvider>
				) : (
					app
				)}
				<Scripts />
			</body>
		</html>
	);
}
