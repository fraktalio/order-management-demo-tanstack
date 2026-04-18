import { Link } from '@tanstack/react-router';

import { useState } from 'react';
import { Home, Menu, X, Play, UtensilsCrossed, ShoppingCart, ChefHat } from 'lucide-react';

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<header className="flex items-center justify-between bg-gray-800 p-4 text-white shadow-lg">
				<button
					onClick={() => setIsOpen(true)}
					className="rounded-lg p-2 transition-colors hover:bg-gray-700"
					aria-label="Open menu"
				>
					<Menu size={24} />
				</button>
				<h1 className="text-xl font-semibold">
					<Link to="/" className="flex items-center gap-2">
						<img src="/f.webp" alt="Fraktalio Logo" className="h-10" />
						<span className="text-4xl">{'{Restaurant}'}</span>
					</Link>
				</h1>
			</header>

			<aside
				className={`fixed top-0 left-0 z-50 flex h-full w-80 transform flex-col bg-gray-900 text-white shadow-2xl transition-transform duration-300 ease-in-out ${
					isOpen ? 'translate-x-0' : '-translate-x-full'
				}`}
			>
				<div className="flex items-center justify-between border-b border-gray-700 p-4">
					<h2 className="text-xl font-bold">Navigation</h2>
					<button
						onClick={() => setIsOpen(false)}
						className="rounded-lg p-2 transition-colors hover:bg-gray-800"
						aria-label="Close menu"
					>
						<X size={24} />
					</button>
				</div>

				<nav className="flex-1 overflow-y-auto p-4">
					<Link
						to="/"
						onClick={() => setIsOpen(false)}
						className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-800"
						activeProps={{
							className:
								'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
						}}
					>
						<Home size={20} />
						<span className="font-medium">Home</span>
					</Link>

					{/* Domain Pages */}
					<Link
						to="/restaurant"
						onClick={() => setIsOpen(false)}
						className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-800"
						activeProps={{
							className:
								'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
						}}
					>
						<UtensilsCrossed size={20} />
						<span className="font-medium">Restaurant</span>
					</Link>
					<Link
						to="/order"
						onClick={() => setIsOpen(false)}
						className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-800"
						activeProps={{
							className:
								'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
						}}
					>
						<ShoppingCart size={20} />
						<span className="font-medium">Order</span>
					</Link>
					<Link
						to="/kitchen"
						onClick={() => setIsOpen(false)}
						className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-800"
						activeProps={{
							className:
								'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
						}}
					>
						<ChefHat size={20} />
						<span className="font-medium">Kitchen</span>
					</Link>

					{/* Demo Links */}
					<Link
						to="/workflow"
						onClick={() => setIsOpen(false)}
						className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-800"
						activeProps={{
							className:
								'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
						}}
					>
						<Play size={20} />
						<span className="font-medium">Workflow</span>
					</Link>
				</nav>
			</aside>
		</>
	);
}
