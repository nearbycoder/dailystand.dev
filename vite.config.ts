import { fileURLToPath, URL } from "node:url";
import { sentryTanstackStart } from "@sentry/tanstackstart-react";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const allowedHosts = (env.ALLOWED_HOSTS ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	const hasSentryVitePluginConfig = Boolean(
		env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT,
	);

	return {
		server: {
			...(allowedHosts.length > 0 ? { allowedHosts } : {}),
			proxy: {
				"/ingest": {
					target: "https://us.i.posthog.com",
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/ingest/, ""),
					secure: false,
				},
			},
		},
		resolve: {
			alias: {
				"@": fileURLToPath(new URL("./src", import.meta.url)),
			},
		},
		plugins: [
			devtools(),
			nitro({ rollupConfig: { external: [/^@sentry\//] } }),
			// this is the plugin that enables path aliases
			viteTsConfigPaths({
				projects: ["./tsconfig.json"],
			}),
			tailwindcss(),
			tanstackStart(),
			viteReact(),
			...(hasSentryVitePluginConfig
				? [
						sentryTanstackStart({
							authToken: env.SENTRY_AUTH_TOKEN,
							org: env.SENTRY_ORG,
							project: env.SENTRY_PROJECT,
						}),
					]
				: []),
		],
	};
});

export default config;
