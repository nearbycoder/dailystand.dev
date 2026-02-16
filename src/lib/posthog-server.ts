import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
	const apiKey =
		process.env.VITE_PUBLIC_POSTHOG_KEY ||
		import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
	if (!apiKey) return null;

	if (!posthogClient) {
		posthogClient = new PostHog(
			apiKey,
			{
				host:
					process.env.VITE_PUBLIC_POSTHOG_HOST ||
					import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
				flushAt: 1,
				flushInterval: 0,
			},
		);
	}
	return posthogClient;
}
