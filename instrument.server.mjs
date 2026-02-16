import * as Sentry from "@sentry/tanstackstart-react";

function parseRate(value, fallback) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(0, Math.min(1, parsed));
}

const dsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN;

if (dsn) {
	Sentry.init({
		dsn,
		sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === "true",
		enableLogs: process.env.SENTRY_ENABLE_LOGS === "true",
		tracesSampleRate: parseRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
	});
}
