import { Link } from '@tanstack/react-router';

import { useState } from 'react';
import { Home, Menu, X, Play, UtensilsCrossed, ChefHat, Github } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white/95 p-4 text-slate-900 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95 dark:text-white dark:shadow-lg">
				<button
					onClick={() => setIsOpen(true)}
					className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
					aria-label="Open menu"
				>
					<Menu size={24} />
				</button>
				<div className="flex items-center gap-4">
					<ThemeToggle />
					<a
						href="https://github.com/fraktalio/order-management-demo-tanstack"
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
						aria-label="View source on GitHub"
					>
						<Github size={20} />
					</a>
					<h1 className="text-xl font-semibold">
						<Link to="/" className="flex items-center gap-2">
							<img src="/f.webp" alt="Fraktalio Logo" className="h-4" />
							<span className="text-xl">{'{Restaurant}'}</span>
						</Link>
					</h1>
				</div>
			</header>

			<aside
				className={`fixed top-0 left-0 z-50 flex h-full w-80 transform flex-col bg-white text-slate-900 shadow-2xl transition-transform duration-300 ease-in-out dark:bg-gray-900 dark:text-white ${
					isOpen ? 'translate-x-0' : '-translate-x-full'
				}`}
			>
				<div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
					<h2 className="text-xl font-bold">Navigation</h2>
					<button
						onClick={() => setIsOpen(false)}
						className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
						aria-label="Close menu"
					>
						<X size={24} />
					</button>
				</div>

				<nav className="flex-1 overflow-y-auto p-4">
					<Link
						to="/"
						onClick={() => setIsOpen(false)}
						className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
						activeProps={{
							className:
								'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors mb-2',
						}}
					>
						<Home size={20} />
						<span className="font-medium">Home</span>
					</Link>

					<Link
						to="/restaurant"
						onClick={() => setIsOpen(false)}
						className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
						activeProps={{
							className:
								'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors mb-2',
						}}
					>
						<UtensilsCrossed size={20} />
						<span className="font-medium">Restaurant</span>
					</Link>
					<Link
						to="/order-workflow"
						onClick={() => setIsOpen(false)}
						className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
						activeProps={{
							className:
								'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors mb-2',
						}}
					>
						<Play size={20} />
						<span className="font-medium">Order Workflow</span>
					</Link>
					<Link
						to="/kitchen"
						onClick={() => setIsOpen(false)}
						className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
						activeProps={{
							className:
								'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors mb-2',
						}}
					>
						<ChefHat size={20} />
						<span className="font-medium">Kitchen</span>
					</Link>
				</nav>
			</aside>
		</>
	);
}
