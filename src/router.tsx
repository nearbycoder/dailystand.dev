import * as Sentry from "@sentry/tanstackstart-react";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

type RuntimePublicEnv = {
	VITE_SENTRY_DSN?: string;
	VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
	VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE?: string;
	VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE?: string;
	VITE_SENTRY_SEND_DEFAULT_PII?: string;
	VITE_SENTRY_ENABLE_IN_DEV?: string;
};

function parseRate(value: string | undefined, fallback: number) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(0, Math.min(1, parsed));
}

function readRuntimePublicEnv(): RuntimePublicEnv {
	if (typeof window === "undefined") {
		return {};
	}
	return (
		(window as Window & { __DS_PUBLIC_ENV__?: RuntimePublicEnv })
			.__DS_PUBLIC_ENV__ ?? {}
	);
}

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,

		context: getContext(),

		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});

	const runtimeEnv = readRuntimePublicEnv();
	const sentryDsn = runtimeEnv.VITE_SENTRY_DSN ?? import.meta.env.VITE_SENTRY_DSN;
	const sentryEnableInDev =
		runtimeEnv.VITE_SENTRY_ENABLE_IN_DEV ??
		import.meta.env.VITE_SENTRY_ENABLE_IN_DEV;
	const sentryTracesSampleRate =
		runtimeEnv.VITE_SENTRY_TRACES_SAMPLE_RATE ??
		import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE;
	const sentryReplaysSessionSampleRate =
		runtimeEnv.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ??
		import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE;
	const sentryReplaysOnErrorSampleRate =
		runtimeEnv.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ??
		import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE;
	const sentrySendDefaultPii =
		runtimeEnv.VITE_SENTRY_SEND_DEFAULT_PII ??
		import.meta.env.VITE_SENTRY_SEND_DEFAULT_PII;

	if (
		!router.isServer &&
		sentryDsn &&
		!Sentry.getClient()
	) {
		const replaysSessionSampleRate = parseRate(
			sentryReplaysSessionSampleRate,
			0,
		);
		const replaysOnErrorSampleRate = parseRate(
			sentryReplaysOnErrorSampleRate,
			1,
		);
		const tracesSampleRate = parseRate(sentryTracesSampleRate, 0.1);

		Sentry.init({
			dsn: sentryDsn,
			integrations: [
				Sentry.tanstackRouterBrowserTracingIntegration(router),
				...(replaysSessionSampleRate > 0 || replaysOnErrorSampleRate > 0
					? [Sentry.replayIntegration()]
					: []),
			],
			tracesSampleRate,
			replaysSessionSampleRate,
			replaysOnErrorSampleRate,
			sendDefaultPii: sentrySendDefaultPii === "true",
			enabled: import.meta.env.PROD || sentryEnableInDev === "true",
		});
	}

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
