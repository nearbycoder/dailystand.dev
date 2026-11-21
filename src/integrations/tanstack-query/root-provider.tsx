import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { useState } from "react";
import superjson from "superjson";

import { TRPCProvider } from "@/integrations/trpc/react";
import type { TRPCRouter } from "@/integrations/trpc/router";
import { ThemeProvider } from "@/lib/theme";

function getUrl() {
	const base = (() => {
		if (typeof window !== "undefined") return "";
		return `http://localhost:${process.env.PORT ?? 3000}`;
	})();
	return `${base}/api/trpc`;
}

export const trpcClient = createTRPCClient<TRPCRouter>({
	links: [
		httpBatchStreamLink({
			transformer: superjson,
			url: getUrl(),
		}),
	],
});

const NON_RETRYABLE_TRPC_CODES = new Set([
	"BAD_REQUEST",
	"UNAUTHORIZED",
	"FORBIDDEN",
	"NOT_FOUND",
	"METHOD_NOT_SUPPORTED",
	"CONFLICT",
	"PRECONDITION_FAILED",
	"PAYLOAD_TOO_LARGE",
	"UNPROCESSABLE_CONTENT",
	"PARSE_ERROR",
]);

export function shouldRetryQuery(
	failureCount: number,
	error: unknown,
): boolean {
	if (failureCount >= 1) return false;
	if (error && typeof error === "object") {
		const data = (error as { data?: { code?: unknown; httpStatus?: unknown } })
			.data;
		if (
			typeof data?.code === "string" &&
			NON_RETRYABLE_TRPC_CODES.has(data.code)
		) {
			return false;
		}
		if (
			typeof data?.httpStatus === "number" &&
			data.httpStatus >= 400 &&
			data.httpStatus < 500 &&
			data.httpStatus !== 408 &&
			data.httpStatus !== 429
		) {
			return false;
		}
	}
	return true;
}

function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				gcTime: 5 * 60_000,
				retry: shouldRetryQuery,
				retryDelay: 500,
			},
			dehydrate: { serializeData: superjson.serialize },
			hydrate: { deserializeData: superjson.deserialize },
		},
	});
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
	if (typeof window === "undefined") {
		return makeQueryClient();
	}
	if (!browserQueryClient) {
		browserQueryClient = makeQueryClient();
	}
	return browserQueryClient;
}

export function getContext() {
	const queryClient = makeQueryClient();

	const serverHelpers = createTRPCOptionsProxy({
		client: trpcClient,
		queryClient: queryClient,
	});
	return {
		queryClient,
		trpc: serverHelpers,
	};
}

export default function Providers({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(() => getQueryClient());

	return (
		<ThemeProvider>
			<QueryClientProvider client={queryClient}>
				<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
					{children}
				</TRPCProvider>
			</QueryClientProvider>
		</ThemeProvider>
	);
}
