import * as Sentry from "@sentry/tanstackstart-react";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

function parseRate(value: string | undefined, fallback: number) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(0, Math.min(1, parsed));
}

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,

		context: getContext(),

		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});

	if (
		!router.isServer &&
		import.meta.env.VITE_SENTRY_DSN &&
		!Sentry.getClient()
	) {
		const replaysSessionSampleRate = parseRate(
			import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
			0,
		);
		const replaysOnErrorSampleRate = parseRate(
			import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
			1,
		);
		const tracesSampleRate = parseRate(
			import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
			0.1,
		);

		Sentry.init({
			dsn: import.meta.env.VITE_SENTRY_DSN,
			integrations: [
				Sentry.tanstackRouterBrowserTracingIntegration(router),
				...(replaysSessionSampleRate > 0 || replaysOnErrorSampleRate > 0
					? [Sentry.replayIntegration()]
					: []),
			],
			tracesSampleRate,
			replaysSessionSampleRate,
			replaysOnErrorSampleRate,
			sendDefaultPii: import.meta.env.VITE_SENTRY_SEND_DEFAULT_PII === "true",
			enabled:
				import.meta.env.PROD ||
				import.meta.env.VITE_SENTRY_ENABLE_IN_DEV === "true",
		});
	}

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
