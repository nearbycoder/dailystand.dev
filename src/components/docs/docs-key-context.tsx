import { createContext, useContext, useEffect, useMemo, useState } from "react";

const DOCS_KEY_STORAGE_KEY = "ds_docs_api_key";

type DocsKeyContextValue = {
	apiKey: string;
	setApiKey: (value: string) => void;
	showApiKey: boolean;
	setShowApiKey: (value: boolean) => void;
	baseUrl: string;
};

const DocsKeyContext = createContext<DocsKeyContextValue | null>(null);

export function DocsKeyProvider({ children }: { children: React.ReactNode }) {
	const [apiKey, setApiKeyState] = useState("");
	const [showApiKey, setShowApiKey] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const stored = window.sessionStorage.getItem(DOCS_KEY_STORAGE_KEY);
		if (stored) setApiKeyState(stored);
	}, []);

	const setApiKey = (value: string) => {
		setApiKeyState(value);
		if (typeof window !== "undefined") {
			window.sessionStorage.setItem(DOCS_KEY_STORAGE_KEY, value);
		}
	};

	const baseUrl = useMemo(() => {
		if (typeof window === "undefined") return "https://your-domain.com";
		return window.location.origin;
	}, []);

	return (
		<DocsKeyContext.Provider
			value={{
				apiKey,
				setApiKey,
				showApiKey,
				setShowApiKey,
				baseUrl,
			}}
		>
			{children}
		</DocsKeyContext.Provider>
	);
}

export function useDocsKey() {
	const context = useContext(DocsKeyContext);
	if (!context) {
		throw new Error("useDocsKey must be used within DocsKeyProvider");
	}
	return context;
}
