import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

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
		try {
			const stored = window.sessionStorage.getItem(DOCS_KEY_STORAGE_KEY);
			if (stored) setApiKeyState(stored);
		} catch {
			// sessionStorage may be unavailable in restricted contexts.
		}
	}, []);

	const setApiKey = useCallback((value: string) => {
		setApiKeyState(value);
		if (typeof window !== "undefined") {
			try {
				window.sessionStorage.setItem(DOCS_KEY_STORAGE_KEY, value);
			} catch {
				// Ignore storage write failures.
			}
		}
	}, []);

	const baseUrl = useMemo(() => {
		if (typeof window === "undefined") return "https://your-domain.com";
		return window.location.origin;
	}, []);

	const value = useMemo(
		() => ({
			apiKey,
			setApiKey,
			showApiKey,
			setShowApiKey,
			baseUrl,
		}),
		[apiKey, setApiKey, showApiKey, baseUrl],
	);

	return (
		<DocsKeyContext.Provider value={value}>{children}</DocsKeyContext.Provider>
	);
}

export function useDocsKey() {
	const context = useContext(DocsKeyContext);
	if (!context) {
		throw new Error("useDocsKey must be used within DocsKeyProvider");
	}
	return context;
}
