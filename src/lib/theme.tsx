import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

type Theme = "dark" | "light" | "system";

interface ThemeContext {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	resolved: "dark" | "light";
}

const ThemeCtx = createContext<ThemeContext>({
	theme: "system",
	setTheme: () => {},
	resolved: "dark",
});

function getSystemTheme(): "dark" | "light" {
	if (typeof window === "undefined") return "dark";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function resolveTheme(theme: Theme): "dark" | "light" {
	if (theme === "system") return getSystemTheme();
	return theme;
}

function readStoredTheme(): Theme {
	if (typeof window === "undefined") return "system";
	try {
		const stored = localStorage.getItem("ds-theme");
		if (stored === "dark" || stored === "light" || stored === "system") {
			return stored;
		}
		return "system";
	} catch {
		return "system";
	}
}

function applyTheme(resolved: "dark" | "light") {
	if (typeof document === "undefined") return;
	const html = document.documentElement;
	html.classList.remove("dark", "light");
	html.classList.add(resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<Theme>("system");
	const [resolved, setResolved] = useState<"dark" | "light">("light");

	// Initialize from localStorage
	useEffect(() => {
		const t = readStoredTheme();
		setThemeState(t);
		const r = resolveTheme(t);
		setResolved(r);
		applyTheme(r);
	}, []);

	// Listen for system theme changes
	useEffect(() => {
		if (theme !== "system") return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => {
			const r = getSystemTheme();
			setResolved(r);
			applyTheme(r);
		};
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, [theme]);

	const setTheme = useCallback((t: Theme) => {
		setThemeState(t);
		try {
			localStorage.setItem("ds-theme", t);
		} catch {
			// Storage may be unavailable in restricted browser contexts.
		}
		const r = resolveTheme(t);
		setResolved(r);
		applyTheme(r);
	}, []);

	const value = useMemo(
		() => ({ theme, setTheme, resolved }),
		[theme, setTheme, resolved],
	);

	return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
	return useContext(ThemeCtx);
}
