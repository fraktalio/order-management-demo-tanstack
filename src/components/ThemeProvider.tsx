import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

type ThemeContextValue = {
	theme: Theme;
	setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
	theme: 'system',
	setTheme: () => {},
});

export function useTheme() {
	return useContext(ThemeContext);
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
	if (theme !== 'system') return theme;
	if (typeof window === 'undefined') return 'dark';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<Theme>(() => {
		if (typeof window === 'undefined') return 'system';
		return (localStorage.getItem('theme') as Theme) ?? 'system';
	});

	const setTheme = (t: Theme) => {
		setThemeState(t);
		localStorage.setItem('theme', t);
	};

	useEffect(() => {
		const apply = () => {
			const resolved = resolveTheme(theme);
			document.documentElement.classList.toggle('dark', resolved === 'dark');
		};
		apply();

		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = () => {
			if (theme === 'system') apply();
		};
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	}, [theme]);

	return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
