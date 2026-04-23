export default function Footer() {
	return (
		<footer className="border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-white/20 dark:bg-slate-900">
			<div className="mx-auto flex max-w-7xl items-center justify-between text-sm text-gray-500 dark:text-gray-400">
				<span>© 2026 Fraktalio</span>
				<a
					href="mailto:info@fraktalio.com"
					className="transition-colors hover:text-slate-900 dark:hover:text-white"
				>
					info@fraktalio.com
				</a>
			</div>
		</footer>
	);
}
