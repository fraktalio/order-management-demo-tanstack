import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { useState, useEffect, useRef } from 'react';
import { withDb } from '@/infrastructure/db';
import { restaurantView, type RestaurantViewState } from '@/domain/views/restaurantView';
import { orderView, type OrderViewState } from '@/domain/views/orderView';
import type { OrderWorkflowParams, PaymentEvent } from '@/application/workflows/paymentWorkflow';
import {
	Play,
	CreditCard,
	ClipboardCopy,
	Check,
	Loader2,
	CheckCircle2,
	XCircle,
	Clock,
	Search,
} from 'lucide-react';

// ─── Server Functions ───────────────────────────────────────────────

const startOrderWorkflow = createServerFn({ method: 'POST' })
	.inputValidator((input: OrderWorkflowParams) => input)
	.handler(async ({ data }) => {
		const instance = await env.MY_WORKFLOW.create({ params: data });
		return { instanceId: instance.id };
	});

const getWorkflowStatus = createServerFn({ method: 'POST' })
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		const instance = await env.MY_WORKFLOW.get(id);
		const status = await instance.status();
		return {
			status: status.status,
			error: status.error,
			output: status.output as
				| {
						orderId: string;
						restaurantId: string;
						payment: { transactionId: string; amount: string; status: string };
						finalStatus: string;
				  }
				| undefined,
		};
	});

const sendPaymentEvent = createServerFn({ method: 'POST' })
	.inputValidator((input: { instanceId: string; payment: PaymentEvent }) => input)
	.handler(async ({ data }) => {
		const instance = await env.MY_WORKFLOW.get(data.instanceId);
		await instance.sendEvent({ type: 'payment-received', payload: data.payment });
		return { sent: true };
	});

const fetchAllRestaurants = createServerFn({ method: 'POST' }).handler(async () => {
	return withDb(env, async (sql) => {
		const rows = await sql.unsafe<{ data: Buffer }[]>(
			`SELECT e.data FROM dcb.events e
			 WHERE e.type IN ('RestaurantCreatedEvent', 'RestaurantMenuChangedEvent')
			 ORDER BY e.id ASC`,
		);
		const map = new Map<string, RestaurantViewState>();
		for (const row of rows) {
			const event = JSON.parse(Buffer.from(row.data).toString('utf-8'));
			const rid = event.restaurantId as string;
			const current = map.get(rid) ?? restaurantView.initialState;
			const next = restaurantView.evolve(current, event);
			if (next) map.set(rid, next);
		}
		return Array.from(map.values());
	});
});

const fetchOrderByWorkflow = createServerFn({ method: 'POST' })
	.inputValidator((input: { orderId: string; restaurantId: string }) => input)
	.handler(async ({ data }) => {
		return withDb(env, async (sql) => {
			const rows = await sql.unsafe<{ data: Buffer }[]>(
				`SELECT e.data FROM dcb.events e
				 WHERE e.type IN ('RestaurantOrderPlacedEvent', 'OrderPaidEvent', 'OrderPaymentFailedEvent', 'OrderPreparedEvent')
				 ORDER BY e.id ASC`,
			);
			let state: OrderViewState | null = null;
			for (const row of rows) {
				const event = JSON.parse(Buffer.from(row.data).toString('utf-8'));
				if (event.orderId === data.orderId) {
					state = orderView.evolve(state, event);
				}
			}
			return state;
		});
	});

// ─── Search Params ──────────────────────────────────────────────────

type WorkflowSearch = {
	instanceId?: string;
	rid?: string;
	oid?: string;
	items?: string;
};

// ─── Route ──────────────────────────────────────────────────────────

export const Route = createFileRoute('/order-workflow')({
	component: OrderWorkflowPage,
	validateSearch: (search: Record<string, unknown>): WorkflowSearch => ({
		instanceId: typeof search.instanceId === 'string' ? search.instanceId : undefined,
		rid: typeof search.rid === 'string' ? search.rid : undefined,
		oid: typeof search.oid === 'string' ? search.oid : undefined,
		items: typeof search.items === 'string' ? search.items : undefined,
	}),
});

// ─── Types ──────────────────────────────────────────────────────────

type Status = { type: 'idle' | 'loading' | 'success' | 'error'; message?: string };
type WorkflowStatusResponse = Awaited<ReturnType<typeof getWorkflowStatus>>;

// ─── Page ───────────────────────────────────────────────────────────

function OrderWorkflowPage() {
	return (
		<div className="min-h-screen bg-slate-900 p-8 text-white">
			<div className="mx-auto max-w-3xl">
				<div className="mb-8 flex items-center gap-3">
					<Play className="h-8 w-8 text-cyan-400" />
					<div>
						<h1 className="text-3xl font-bold">Order Workflow</h1>
						<p className="text-sm text-gray-400">
							Place an order → Await payment → Mark paid or failed
						</p>
					</div>
				</div>
				<WorkflowOrchestrator />
				<hr className="my-10 border-slate-700" />
				<OrderTracker />
			</div>
		</div>
	);
}

// ─── Workflow Orchestrator ──────────────────────────────────────────

function WorkflowOrchestrator() {
	const search = Route.useSearch();
	const navigate = useNavigate();

	const [rid, setRid] = useState(search.rid ?? '');
	const [oid, setOid] = useState<string>(search.oid ?? crypto.randomUUID());
	const [restaurants, setRestaurants] = useState<RestaurantViewState[]>([]);
	const [restaurant, setRestaurant] = useState<RestaurantViewState | null>(null);
	const [selectedItems, setSelectedItems] = useState<Set<string>>(
		search.items ? new Set(search.items.split(',')) : new Set(),
	);
	const [listStatus, setListStatus] = useState<Status>({ type: 'idle' });
	const [instanceId, setInstanceId] = useState<string | null>(search.instanceId ?? null);
	const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatusResponse | null>(null);
	const [submitStatus, setSubmitStatus] = useState<Status>(
		search.instanceId ? { type: 'success', message: 'Workflow started' } : { type: 'idle' },
	);
	const [paymentStatus, setPaymentStatus] = useState<Status>({ type: 'idle' });
	const [copied, setCopied] = useState(false);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const stopPolling = () => {
		if (pollRef.current) {
			clearInterval(pollRef.current);
			pollRef.current = null;
		}
	};

	useEffect(() => () => stopPolling(), []);

	useEffect(() => {
		setListStatus({ type: 'loading' });
		fetchAllRestaurants()
			.then((data) => {
				setRestaurants(data);
				setListStatus({ type: 'success' });
				if (search.rid) {
					const found = data.find((r) => r.restaurantId === search.rid) ?? null;
					setRestaurant(found);
				}
			})
			.catch((err) => {
				setListStatus({
					type: 'error',
					message: err instanceof Error ? err.message : 'Failed to load restaurants',
				});
			});
	}, []);

	useEffect(() => {
		if (search.instanceId) {
			getWorkflowStatus({ data: search.instanceId })
				.then((res) => {
					setWorkflowStatus(res);
					if (!isTerminal(res.status)) startPolling(search.instanceId!);
				})
				.catch(() => {});
		}
	}, []);

	const isTerminal = (s: string) => ['complete', 'errored', 'terminated'].includes(s);

	const startPolling = (id: string) => {
		stopPolling();
		pollRef.current = setInterval(async () => {
			try {
				const res = await getWorkflowStatus({ data: id });
				setWorkflowStatus(res);
				if (isTerminal(res.status)) stopPolling();
			} catch {
				stopPolling();
			}
		}, 2000);
	};

	const updateSearchParams = (params: WorkflowSearch) => {
		navigate({
			to: '/order-workflow',
			search: (prev) => ({ ...prev, ...params }),
			replace: true,
		});
	};

	const handleRestaurantChange = (selectedId: string) => {
		setRid(selectedId);
		setSelectedItems(new Set());
		setRestaurant(restaurants.find((r) => r.restaurantId === selectedId) ?? null);
	};

	const toggleItem = (id: string) => {
		setSelectedItems((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const copyOrderId = async () => {
		await navigator.clipboard.writeText(oid);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	const handleStartWorkflow = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!restaurant) return;
		const chosen = restaurant.menu.menuItems.filter((item) => selectedItems.has(item.menuItemId));
		if (chosen.length === 0) {
			setSubmitStatus({ type: 'error', message: 'Select at least one menu item' });
			return;
		}
		setSubmitStatus({ type: 'loading' });
		try {
			const res = await startOrderWorkflow({
				data: {
					restaurantId: rid,
					orderId: oid,
					menuItems: chosen.map((item) => ({
						menuItemId: item.menuItemId,
						name: item.name,
						price: item.price,
					})),
				},
			});
			setInstanceId(res.instanceId);
			setSubmitStatus({ type: 'success', message: 'Workflow started' });
			updateSearchParams({
				instanceId: res.instanceId,
				rid,
				oid,
				items: Array.from(selectedItems).join(','),
			});
			startPolling(res.instanceId);
		} catch (err) {
			setSubmitStatus({
				type: 'error',
				message: err instanceof Error ? err.message : 'Failed to start workflow',
			});
		}
	};

	const handlePayment = async (success: boolean) => {
		if (!instanceId) return;
		setPaymentStatus({ type: 'loading' });
		const totalAmount = restaurant
			? restaurant.menu.menuItems
					.filter((item) => selectedItems.has(item.menuItemId))
					.reduce((sum, item) => sum + parseFloat(item.price || '0'), 0)
					.toFixed(2)
			: '0.00';
		try {
			await sendPaymentEvent({
				data: {
					instanceId,
					payment: {
						transactionId: 'txn_' + crypto.randomUUID().slice(0, 8),
						amount: totalAmount,
						status: success ? 'success' : 'failed',
					},
				},
			});
			setPaymentStatus({
				type: 'success',
				message: success
					? 'Payment approved — order marked as paid'
					: 'Payment declined — order marked as payment failed',
			});
		} catch (err) {
			setPaymentStatus({
				type: 'error',
				message: err instanceof Error ? err.message : 'Failed to send payment',
			});
		}
	};

	const isWaitingForPayment =
		workflowStatus?.status === 'waiting' || workflowStatus?.status === 'running';
	const workflowStarted = instanceId !== null;
	const paymentFailed = workflowStatus?.output?.finalStatus === 'payment_failed';

	return (
		<div className="space-y-8">
			{/* Step 1: Select restaurant & items */}
			<StepCard number={1} title="Place Order" active={!workflowStarted} done={workflowStarted}>
				<form onSubmit={handleStartWorkflow} className="space-y-4">
					{submitStatus.type === 'error' && (
						<p className="text-sm text-red-400">{submitStatus.message}</p>
					)}
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label htmlFor="wf-rid" className="block text-sm font-medium text-gray-300">
								Restaurant
							</label>
							<select
								id="wf-rid"
								value={rid}
								onChange={(e) => handleRestaurantChange(e.target.value)}
								required
								disabled={workflowStarted || listStatus.type === 'loading'}
								className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
							>
								<option value="">
									{listStatus.type === 'loading'
										? 'Loading restaurants…'
										: restaurants.length === 0
											? 'No restaurants available'
											: 'Select a restaurant'}
								</option>
								{restaurants.map((r) => (
									<option key={r.restaurantId} value={r.restaurantId}>
										{r.name} — {r.menu.cuisine}
									</option>
								))}
							</select>
							{listStatus.type === 'error' && (
								<p className="mt-1 text-xs text-red-400">{listStatus.message}</p>
							)}
						</div>
						<div>
							<label htmlFor="wf-oid" className="block text-sm font-medium text-gray-300">
								Order ID
							</label>
							<div className="mt-1 flex gap-2">
								<input
									id="wf-oid"
									type="text"
									value={oid}
									onChange={(e) => setOid(e.target.value)}
									required
									disabled={workflowStarted}
									className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
								/>
								<button
									type="button"
									onClick={copyOrderId}
									disabled={workflowStarted}
									className="rounded-lg bg-slate-700 px-3 py-2 transition-colors hover:bg-slate-600 disabled:opacity-50"
									aria-label="Copy order ID"
								>
									{copied ? (
										<Check size={18} className="text-green-400" />
									) : (
										<ClipboardCopy size={18} />
									)}
								</button>
							</div>
						</div>
					</div>

					{restaurant && restaurant.menu.menuItems.length > 0 && (
						<fieldset className="space-y-2">
							<legend className="text-sm font-medium text-gray-300">
								{restaurant.name} — {restaurant.menu.cuisine}
							</legend>
							<div className="overflow-hidden rounded-lg border border-slate-700">
								<table className="w-full text-sm">
									<thead>
										<tr className="bg-slate-800">
											<th className="w-10 px-3 py-2 text-left"></th>
											<th className="px-3 py-2 text-left text-gray-300">Name</th>
											<th className="px-3 py-2 text-left text-gray-300">Price</th>
										</tr>
									</thead>
									<tbody>
										{restaurant.menu.menuItems.map((item) => (
											<tr
												key={item.menuItemId}
												onClick={() => !workflowStarted && toggleItem(item.menuItemId)}
												className={`border-t border-slate-700 transition-colors ${workflowStarted ? 'opacity-50' : 'cursor-pointer hover:bg-slate-800'}`}
											>
												<td className="px-3 py-2">
													<input
														type="checkbox"
														checked={selectedItems.has(item.menuItemId)}
														onChange={() => toggleItem(item.menuItemId)}
														disabled={workflowStarted}
														aria-label={`Select ${item.name}`}
														className="accent-cyan-500"
													/>
												</td>
												<td className="px-3 py-2">{item.name}</td>
												<td className="px-3 py-2">{item.price}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</fieldset>
					)}

					{!workflowStarted && (
						<button
							type="submit"
							disabled={submitStatus.type === 'loading' || selectedItems.size === 0}
							className="flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-2 font-semibold transition-colors hover:bg-cyan-600 disabled:opacity-50"
						>
							<Play size={18} />
							{submitStatus.type === 'loading' ? 'Starting…' : 'Place Order & Start Workflow'}
						</button>
					)}
				</form>
			</StepCard>

			{/* Step 2: Payment Gateway */}
			<StepCard
				number={2}
				title="Payment Gateway"
				active={workflowStarted && isWaitingForPayment && paymentStatus.type !== 'success'}
				done={paymentStatus.type === 'success'}
			>
				{!workflowStarted ? (
					<p className="text-sm text-gray-500">Place an order to proceed to payment.</p>
				) : paymentStatus.type === 'success' ? (
					<p
						className={`text-sm ${paymentStatus.message?.includes('declined') ? 'text-red-400' : 'text-green-400'}`}
					>
						{paymentStatus.message}
					</p>
				) : (
					<div className="space-y-4">
						<p className="text-sm text-gray-300">
							The workflow is waiting for a payment event. Simulate the payment gateway response:
						</p>
						{paymentStatus.type === 'error' && (
							<p className="text-sm text-red-400">{paymentStatus.message}</p>
						)}
						<div className="flex gap-3">
							<button
								onClick={() => handlePayment(true)}
								disabled={paymentStatus.type === 'loading'}
								className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 font-semibold transition-colors hover:bg-green-700 disabled:opacity-50"
							>
								<CreditCard size={18} />
								{paymentStatus.type === 'loading' ? 'Sending…' : 'Approve Payment'}
							</button>
							<button
								onClick={() => handlePayment(false)}
								disabled={paymentStatus.type === 'loading'}
								className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 font-semibold transition-colors hover:bg-red-700 disabled:opacity-50"
							>
								<XCircle size={18} />
								Decline Payment
							</button>
						</div>
					</div>
				)}
			</StepCard>

			{/* Step 3: Result */}
			<StepCard
				number={3}
				title="Result"
				active={false}
				done={workflowStatus?.status === 'complete'}
			>
				{workflowStatus?.status === 'complete' && workflowStatus.output ? (
					<div className="space-y-3">
						<p className={paymentFailed ? 'text-red-400' : 'text-green-400'}>
							{paymentFailed
								? 'Payment failed — order will not be prepared.'
								: 'Payment approved — order is ready for preparation in the Kitchen.'}
						</p>
						<dl className="space-y-2 text-sm">
							<div className="flex gap-2">
								<dt className="font-medium text-gray-300">Order ID:</dt>
								<dd className="text-gray-400">{workflowStatus.output.orderId}</dd>
							</div>
							<div className="flex gap-2">
								<dt className="font-medium text-gray-300">Transaction:</dt>
								<dd className="text-gray-400">{workflowStatus.output.payment?.transactionId}</dd>
							</div>
							<div className="flex gap-2">
								<dt className="font-medium text-gray-300">Amount:</dt>
								<dd className="text-gray-400">${workflowStatus.output.payment?.amount}</dd>
							</div>
							<div className="flex gap-2">
								<dt className="font-medium text-gray-300">Final Status:</dt>
								<dd>
									<span
										className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
											paymentFailed ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'
										}`}
									>
										{workflowStatus.output.finalStatus?.toUpperCase()}
									</span>
								</dd>
							</div>
						</dl>
					</div>
				) : workflowStatus?.status === 'errored' ? (
					<div className="space-y-2">
						<p className="text-red-400">Workflow failed.</p>
						{workflowStatus.error && (
							<p className="text-sm text-red-300">{workflowStatus.error.message}</p>
						)}
					</div>
				) : (
					<p className="text-sm text-gray-500">Waiting for previous steps to complete.</p>
				)}
			</StepCard>

			{/* Workflow Instance Info */}
			{instanceId && (
				<div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
					<div className="flex items-center justify-between">
						<p className="font-mono text-xs text-gray-500">Instance: {instanceId}</p>
						{workflowStatus && (
							<span
								className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles(workflowStatus.status)}`}
							>
								{statusIcon(workflowStatus.status)}
								{workflowStatus.status}
							</span>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Order Tracker ──────────────────────────────────────────────────

function OrderTracker() {
	const [oid, setOid] = useState('');
	const [rid, setRid] = useState('');
	const [restaurants, setRestaurants] = useState<RestaurantViewState[]>([]);
	const [listStatus, setListStatus] = useState<Status>({ type: 'idle' });
	const [order, setOrder] = useState<OrderViewState | null>(null);
	const [status, setStatus] = useState<Status>({ type: 'idle' });

	useEffect(() => {
		setListStatus({ type: 'loading' });
		fetchAllRestaurants()
			.then((data) => {
				setRestaurants(data);
				setListStatus({ type: 'success' });
			})
			.catch((err) => {
				setListStatus({
					type: 'error',
					message: err instanceof Error ? err.message : 'Failed to load restaurants',
				});
			});
	}, []);

	const trackOrder = async () => {
		if (!oid.trim() || !rid.trim()) return;
		setStatus({ type: 'loading' });
		setOrder(null);
		try {
			const data = await fetchOrderByWorkflow({ data: { orderId: oid, restaurantId: rid } });
			if (data && data.orderId) {
				setOrder(data);
				setStatus({ type: 'success' });
			} else {
				setStatus({ type: 'error', message: 'Order not found' });
			}
		} catch (err) {
			setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Request failed' });
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<Search className="h-6 w-6 text-cyan-400" />
				<h2 className="text-xl font-semibold">Track Order</h2>
			</div>
			{status.type === 'error' && <p className="text-red-400">{status.message}</p>}

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label htmlFor="track-rid" className="block text-sm font-medium text-gray-300">
						Restaurant
					</label>
					<select
						id="track-rid"
						value={rid}
						onChange={(e) => setRid(e.target.value)}
						disabled={listStatus.type === 'loading'}
						className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
					>
						<option value="">
							{listStatus.type === 'loading'
								? 'Loading restaurants…'
								: restaurants.length === 0
									? 'No restaurants available'
									: 'Select a restaurant'}
						</option>
						{restaurants.map((r) => (
							<option key={r.restaurantId} value={r.restaurantId}>
								{r.name} — {r.menu.cuisine}
							</option>
						))}
					</select>
					{listStatus.type === 'error' && (
						<p className="mt-1 text-xs text-red-400">{listStatus.message}</p>
					)}
				</div>
				<div>
					<label htmlFor="track-oid" className="block text-sm font-medium text-gray-300">
						Order ID
					</label>
					<input
						id="track-oid"
						type="text"
						value={oid}
						onChange={(e) => setOid(e.target.value)}
						className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
					/>
				</div>
			</div>

			<button
				type="button"
				onClick={trackOrder}
				disabled={status.type === 'loading'}
				className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 font-medium transition-colors hover:bg-slate-600 disabled:opacity-50"
			>
				<Search size={18} />
				{status.type === 'loading' ? 'Loading…' : 'Track Order'}
			</button>

			{order && (
				<div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
					<dl className="space-y-2 text-sm">
						<div>
							<dt className="font-medium text-gray-300">Order ID</dt>
							<dd className="text-gray-400">{order.orderId}</dd>
						</div>
						<div>
							<dt className="font-medium text-gray-300">Restaurant ID</dt>
							<dd className="text-gray-400">{order.restaurantId}</dd>
						</div>
						<div>
							<dt className="font-medium text-gray-300">Status</dt>
							<dd>
								<span
									className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${orderStatusStyle(order.status)}`}
								>
									{order.status}
								</span>
							</dd>
						</div>
						<div>
							<dt className="font-medium text-gray-300">Menu Items</dt>
							<dd>
								<ul className="list-disc pl-5 text-gray-400">
									{order.menuItems.map((item) => (
										<li key={item.menuItemId}>
											{item.name} — {item.price}
										</li>
									))}
								</ul>
							</dd>
						</div>
					</dl>
				</div>
			)}
		</div>
	);
}

// ─── Step Card ──────────────────────────────────────────────────────

function StepCard({
	number,
	title,
	active,
	done,
	children,
}: {
	number: number;
	title: string;
	active: boolean;
	done: boolean;
	children: React.ReactNode;
}) {
	return (
		<div
			className={`rounded-lg border p-5 transition-colors ${
				done
					? 'border-green-800 bg-green-950/20'
					: active
						? 'border-cyan-700 bg-slate-800/60'
						: 'border-slate-700 bg-slate-800/30'
			}`}
		>
			<div className="mb-3 flex items-center gap-3">
				<span
					className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
						done
							? 'bg-green-600 text-white'
							: active
								? 'bg-cyan-500 text-white'
								: 'bg-slate-700 text-gray-400'
					}`}
				>
					{done ? <Check size={14} /> : number}
				</span>
				<h2 className="text-lg font-semibold">{title}</h2>
				{active && !done && <Loader2 size={16} className="animate-spin text-cyan-400" />}
			</div>
			{children}
		</div>
	);
}

// ─── Helpers ────────────────────────────────────────────────────────

function orderStatusStyle(s: string) {
	switch (s) {
		case 'PREPARED':
			return 'bg-green-900 text-green-200';
		case 'PAID':
			return 'bg-cyan-900 text-cyan-200';
		case 'PAYMENT_FAILED':
			return 'bg-red-900 text-red-200';
		default:
			return 'bg-amber-900 text-amber-200';
	}
}

function statusStyles(s: string) {
	switch (s) {
		case 'complete':
			return 'bg-green-900 text-green-200';
		case 'errored':
		case 'terminated':
			return 'bg-red-900 text-red-200';
		case 'running':
		case 'waiting':
			return 'bg-cyan-900 text-cyan-200';
		default:
			return 'bg-slate-700 text-gray-300';
	}
}

function statusIcon(s: string) {
	switch (s) {
		case 'complete':
			return <CheckCircle2 size={12} />;
		case 'errored':
		case 'terminated':
			return <XCircle size={12} />;
		case 'running':
		case 'waiting':
			return <Clock size={12} />;
		default:
			return null;
	}
}
