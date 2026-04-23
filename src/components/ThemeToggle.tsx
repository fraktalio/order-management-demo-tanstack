import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from './ThemeProvider';

const options = [
	{ value: 'light' as const, icon: Sun, label: 'Light' },
	{ value: 'system' as const, icon: Monitor, label: 'System' },
	{ value: 'dark' as const, icon: Moon, label: 'Dark' },
];

export default function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	return (
		<div className="flex items-center rounded-lg border border-slate-600 dark:border-slate-600">
			{options.map(({ value, icon: Icon, label }) => (
				<button
					key={value}
					onClick={() => setTheme(value)}
					aria-label={`${label} theme`}
					className={`rounded-md p-1.5 transition-colors ${
						theme === value
							? 'bg-cyan-500 text-white'
							: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
					}`}
				>
					<Icon size={14} />
				</button>
			))}
		</div>
	);
}
