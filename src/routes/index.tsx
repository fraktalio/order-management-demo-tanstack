import { createFileRoute } from '@tanstack/react-router';
import { Database, Server, Route as RouteIcon, Shield, GitBranch, Layers } from 'lucide-react';

export const Route = createFileRoute('/')({ component: App });

function App() {
	const features = [
		{
			icon: <GitBranch className="h-12 w-12 text-cyan-600 dark:text-cyan-400" />,
			title: 'Event Sourcing',
			description:
				'Every state change is captured as an immutable event. Full audit trail, time-travel debugging, and reliable replay built in.',
		},
		{
			icon: <Shield className="h-12 w-12 text-cyan-600 dark:text-cyan-400" />,
			title: 'Dynamic Consistency Boundary',
			description:
				'DCB pattern with tag-based event streams. Optimistic concurrency control without rigid aggregate boundaries.',
		},
		{
			icon: <Server className="h-12 w-12 text-cyan-600 dark:text-cyan-400" />,
			title: 'Cloudflare Workers & Workflows',
			description:
				'Deployed to the edge via @cloudflare/vite-plugin. SSR, server functions, and durable Workflows running globally.',
		},
		{
			icon: <Database className="h-12 w-12 text-cyan-600 dark:text-cyan-400" />,
			title: 'Hyperdrive + PostgreSQL',
			description:
				'Postgres as the event store, accelerated by Cloudflare Hyperdrive for connection pooling and low-latency queries.',
		},
		{
			icon: <RouteIcon className="h-12 w-12 text-cyan-600 dark:text-cyan-400" />,
			title: 'TanStack Start',
			description:
				'Full-stack React framework with type-safe file-based routing, server functions, and streaming SSR.',
		},
		{
			icon: <Layers className="h-12 w-12 text-cyan-600 dark:text-cyan-400" />,
			title: 'Fmodel Decider',
			description:
				'Pure functional domain modeling with deciders, projections, and command/query handlers from the fmodel library.',
		},
	];

	return (
		<div className="min-h-screen bg-linear-to-b from-gray-50 via-white to-gray-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
			<section className="relative overflow-hidden px-6 py-20 text-center">
				<div className="absolute inset-0 bg-linear-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5 dark:from-cyan-500/10 dark:via-blue-500/10 dark:to-purple-500/10"></div>
				<div className="relative mx-auto max-w-5xl">
					<div className="mb-6 flex items-center justify-center gap-6">
						<h1 className="text-5xl font-black tracking-normal text-slate-900 md:text-6xl dark:text-white">
							<span className="text-slate-700 dark:text-gray-300">{'{Restaurant}'}</span>{' '}
							<span className="bg-linear-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent dark:from-cyan-400 dark:to-blue-400">
								Demo
							</span>
						</h1>
					</div>
					<p className="mb-4 text-2xl font-light text-slate-600 md:text-3xl dark:text-gray-300">
						Event Sourcing &amp; Dynamic Consistency Boundary on the Edge
					</p>
					<p className="mx-auto mb-8 max-w-3xl text-lg text-slate-500 dark:text-gray-400">
						A restaurant order management{' '}
						<span className="relative inline-block -rotate-2 bg-blue-200 px-1 text-black dark:bg-blue-200">
							demo
						</span>{' '}
						built with{' '}
						<span className="relative inline-block rotate-2 bg-blue-200 px-1 text-black dark:bg-blue-200">
							TanStack Start
						</span>
						, deployed to{' '}
						<span className="relative inline-block -rotate-2 bg-blue-200 px-1 text-black dark:bg-blue-200">
							Cloudflare
						</span>
						Workers via the Vite plugin, backed by PostgreSQL through Hyperdrive, and powered by
						<span className="relative inline-block rotate-2 bg-blue-200 px-1 text-black dark:bg-blue-200">
							fmodel-decider
						</span>{' '}
						for pure functional event sourcing with DCB.
					</p>
					<div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
						<a
							href="https://github.com/fraktalio/fmodel-decider"
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-lg bg-cyan-500 px-8 py-3 font-semibold text-white shadow-lg shadow-cyan-500/30 transition-colors hover:bg-cyan-600 dark:shadow-cyan-500/50"
						>
							Fmodel Decider
						</a>
						<a
							href="https://tanstack.com/start"
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-lg border border-gray-300 px-8 py-3 font-semibold text-slate-600 transition-colors hover:border-gray-400 hover:text-slate-900 dark:border-slate-600 dark:text-gray-300 dark:hover:border-slate-500 dark:hover:text-white"
						>
							TanStack Start
						</a>
					</div>
				</div>
			</section>

			<section className="mx-auto max-w-7xl px-6 py-16">
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{features.map((feature, index) => (
						<div
							key={index}
							className="rounded-xl border border-gray-200 bg-white/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/5 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:shadow-cyan-500/10"
						>
							<div className="mb-4">{feature.icon}</div>
							<h3 className="mb-3 text-xl font-semibold text-slate-900 dark:text-white">
								{feature.title}
							</h3>
							<p className="leading-relaxed text-slate-500 dark:text-gray-400">
								{feature.description}
							</p>
						</div>
					))}
				</div>
			</section>

			<section className="mx-auto max-w-7xl px-6 py-16">
				<div className="overflow-hidden rounded-xl border border-gray-200 bg-white/50 p-2 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/50">
					<img
						src="/workflow.png"
						alt="Event Modeling blueprint showing the restaurant order management system's commands, events, and views"
						className="w-full rounded-lg"
					/>
				</div>
			</section>
		</div>
	);
}
