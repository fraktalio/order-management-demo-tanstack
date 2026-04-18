import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { useState, useEffect, useRef } from 'react';

const triggerWorkflow = createServerFn({ method: 'POST' })
	.inputValidator((input: string) => input)
	.handler(async ({ data: input }) => {
		const instance = await env.MY_WORKFLOW.create({ params: { input } });
		return { id: instance.id };
	});

const getWorkflowStatus = createServerFn({ method: 'POST' })
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		const instance = await env.MY_WORKFLOW.get(id);
		const status = await instance.status();
		return {
			status: status.status,
			error: status.error,
			output: status.output as { result: string } | undefined,
		};
	});

type WorkflowStatus = Awaited<ReturnType<typeof getWorkflowStatus>>;

export const Route = createFileRoute('/workflow')({
	component: WorkflowPage,
});

function WorkflowPage() {
	const [input, setInput] = useState('');
	const [instanceId, setInstanceId] = useState<string | null>(null);
	const [status, setStatus] = useState<WorkflowStatus | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const stopPolling = () => {
		if (pollRef.current) {
			clearInterval(pollRef.current);
			pollRef.current = null;
		}
	};

	useEffect(() => () => stopPolling(), []);

	const isTerminal = (s: string) => ['complete', 'errored', 'terminated'].includes(s);

	const startPolling = (id: string) => {
		stopPolling();
		pollRef.current = setInterval(async () => {
			try {
				const res = await getWorkflowStatus({ data: id });
				setStatus(res);
				if (isTerminal(res.status)) stopPolling();
			} catch {
				setError('Failed to fetch workflow status');
				stopPolling();
			}
		}, 1500);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setStatus(null);
		setInstanceId(null);
		try {
			const res = await triggerWorkflow({ data: input });
			setInstanceId(res.id);
			startPolling(res.id);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to trigger workflow');
		} finally {
			setLoading(false);
		}
	};

	const statusIcon = (s: string) => {
		switch (s) {
			case 'complete':
				return '✓';
			case 'errored':
			case 'terminated':
				return '✗';
			case 'running':
			case 'waiting':
				return '◉';
			default:
				return '○';
		}
	};

	const statusColor = (s: string) => {
		switch (s) {
			case 'complete':
				return 'text-green-400';
			case 'errored':
			case 'terminated':
				return 'text-red-400';
			case 'running':
			case 'waiting':
				return 'text-cyan-400 animate-pulse';
			default:
				return 'text-gray-500';
		}
	};

	return (
		<div className="min-h-screen bg-slate-900 p-8 text-white">
			<div className="mx-auto max-w-xl">
				<h1 className="mb-6 text-3xl font-bold">Trigger Workflow</h1>
				<form onSubmit={handleSubmit} className="mb-6 flex gap-3">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Enter workflow input..."
						className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 focus:border-cyan-500 focus:outline-none"
					/>
					<button
						type="submit"
						disabled={loading}
						className="rounded-lg bg-cyan-500 px-6 py-2 font-semibold transition-colors hover:bg-cyan-600 disabled:opacity-50"
					>
						{loading ? 'Triggering...' : 'Trigger'}
					</button>
				</form>

				{instanceId && (
					<p className="mb-4 font-mono text-sm text-gray-400">Instance: {instanceId}</p>
				)}

				{status && (
					<div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
						<div className="flex items-center gap-3">
							<span className={`font-mono text-lg ${statusColor(status.status)}`}>
								{statusIcon(status.status)}
							</span>
							<span className="font-semibold capitalize">{status.status}</span>
						</div>
						{status.output?.result && (
							<pre className="mt-3 overflow-x-auto text-sm whitespace-pre-wrap text-gray-400">
								{status.output.result}
							</pre>
						)}
						{status.error && <p className="mt-3 text-sm text-red-400">{status.error.message}</p>}
					</div>
				)}

				{status?.status === 'complete' && (
					<div className="rounded-lg border border-green-700 bg-green-900/30 p-4">
						<p className="font-semibold text-green-400">Workflow complete</p>
					</div>
				)}

				{error && (
					<div className="rounded-lg border border-red-700 bg-red-900/30 p-4">
						<p className="text-red-400">{error}</p>
					</div>
				)}
			</div>
		</div>
	);
}
