import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { useState, useEffect, useRef } from 'react';
import { withDb } from '@/infrastructure/db';
import { markOrderAsPreparedHandler } from '@/application/command-handlers/markOrderAsPrepared.ts';
import { orderId, type OrderStatus } from '@/domain/api.ts';
import { orderView, type OrderViewState } from '@/domain/views/orderView.ts';
import { ChefHat, RefreshCw } from 'lucide-react';

// ─── Server Functions ───────────────────────────────────────────────

/**
 * Fetches all orders by querying dcb.events directly for order-related event types,
 * then projects each order through the orderView to compute current state.
 */
const fetchAllOrders = createServerFn({ method: 'POST' }).handler(async () => {
	return withDb(env, async (sql) => {
		// Load all order-related events from the event store
		const rows = await sql.unsafe<{ data: Buffer }[]>(
			`SELECT e.data FROM dcb.events e
			 WHERE e.type IN ('RestaurantOrderPlacedEvent', 'PaymentExemptedEvent', 'OrderPaidEvent', 'OrderPaymentFailedEvent', 'OrderPreparedEvent')
			 ORDER BY e.id ASC`,
		);

		// Parse events and project per order through the view
		const ordersMap = new Map<string, OrderViewState>();

		for (const row of rows) {
			const event = JSON.parse(Buffer.from(row.data).toString('utf-8'));
			const oid = event.orderId as string;

			const currentState = ordersMap.get(oid) ?? orderView.initialState;
			const newState = orderView.evolve(currentState, event);
			if (newState) {
				ordersMap.set(oid, newState);
			}
		}

		return Array.from(ordersMap.values());
	});
});

const markAsPrepared = createServerFn({ method: 'POST' })
	.inputValidator((input: string) => input)
	.handler(async ({ data: oid }) => {
		return withDb(env, (sql) => {
			const handler = markOrderAsPreparedHandler(sql);
			return handler.handle({
				kind: 'MarkOrderAsPreparedCommand',
				orderId: orderId(oid),
			});
		});
	});

// ─── Route ──────────────────────────────────────────────────────────

export const Route = createFileRoute('/kitchen')({
	component: KitchenPage,
});

// ─── Page ───────────────────────────────────────────────────────────

const POLL_INTERVAL = 10_000;

function KitchenPage() {
	const [orders, setOrders] = useState<OrderViewState[]>([]);
	const [autoRefresh, setAutoRefresh] = useState(true);
	const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'error'; message?: string }>({
		type: 'idle',
	});
	const [markingId, setMarkingId] = useState<string | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const loadOrders = async () => {
		setStatus({ type: 'loading' });
		try {
			const data = await fetchAllOrders();
			setOrders(data);
			setStatus({ type: 'idle' });
		} catch (err) {
			setStatus({
				type: 'error',
				message: err instanceof Error ? err.message : 'Failed to fetch orders',
			});
		}
	};

	const startPolling = () => {
		stopPolling();
		intervalRef.current = setInterval(loadOrders, POLL_INTERVAL);
	};

	const stopPolling = () => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	};

	useEffect(() => {
		loadOrders();
		if (autoRefresh) startPolling();
		return () => stopPolling();
	}, [autoRefresh]);

	const handleMarkAsPrepared = async (orderToMark: OrderViewState) => {
		setMarkingId(orderToMark.orderId);
		try {
			await markAsPrepared({ data: orderToMark.orderId });
			// Optimistically update local state
			setOrders((prev) =>
				prev.map((o) =>
					o.orderId === orderToMark.orderId ? { ...o, status: 'PREPARED' as OrderStatus } : o,
				),
			);
		} catch (err) {
			setStatus({
				type: 'error',
				message: err instanceof Error ? err.message : 'Failed to mark order as prepared',
			});
		} finally {
			setMarkingId(null);
		}
	};

	const paidOrders = orders.filter((o) => o.status === 'PAID');
	const preparedOrders = orders.filter((o) => o.status === 'PREPARED');

	return (
		<div className="min-h-screen bg-slate-900 p-8 text-white">
			<div className="mx-auto max-w-3xl">
				<div className="mb-8 flex items-center gap-3">
					<ChefHat className="h-8 w-8 text-cyan-400" />
					<h1 className="text-3xl font-bold">Kitchen Management</h1>
				</div>

				{/* Controls */}
				<div className="mb-8 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<label htmlFor="auto-refresh" className="text-sm font-medium text-gray-300">
							Auto-refresh
						</label>
						<button
							id="auto-refresh"
							type="button"
							role="switch"
							aria-checked={autoRefresh}
							onClick={() => setAutoRefresh((v) => !v)}
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
								autoRefresh ? 'bg-cyan-600' : 'bg-slate-600'
							}`}
						>
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
									autoRefresh ? 'translate-x-6' : 'translate-x-1'
								}`}
							/>
						</button>
					</div>
					<button
						onClick={loadOrders}
						disabled={status.type === 'loading'}
						className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-600 disabled:opacity-50"
					>
						<RefreshCw size={16} className={status.type === 'loading' ? 'animate-spin' : ''} />
						{status.type === 'loading' ? 'Refreshing…' : 'Refresh'}
					</button>
				</div>

				{status.type === 'error' && <p className="mb-4 text-sm text-red-400">{status.message}</p>}

				{/* Paid Orders — Ready for Preparation */}
				<section className="mb-8">
					<h2 className="mb-4 text-xl font-semibold">
						Paid — Ready for Preparation
						{paidOrders.length > 0 && (
							<span className="ml-2 inline-block rounded-full bg-cyan-900 px-2 py-0.5 text-xs text-cyan-200">
								{paidOrders.length}
							</span>
						)}
					</h2>
					{paidOrders.length === 0 ? (
						<p className="text-gray-500">No paid orders awaiting preparation</p>
					) : (
						<div className="space-y-3">
							{paidOrders.map((order) => (
								<div
									key={order.orderId}
									className="rounded-lg border border-cyan-800 bg-cyan-900/20 p-4"
								>
									<div className="flex items-start justify-between gap-4">
										<OrderCard order={order} />
										<button
											onClick={() => handleMarkAsPrepared(order)}
											disabled={markingId === order.orderId}
											className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold transition-colors hover:bg-green-700 disabled:opacity-50"
										>
											{markingId === order.orderId ? 'Marking…' : 'Mark as Prepared'}
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				{/* Prepared Orders */}
				<section>
					<h2 className="mb-4 text-xl font-semibold">
						Prepared Orders
						{preparedOrders.length > 0 && (
							<span className="ml-2 inline-block rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-200">
								{preparedOrders.length}
							</span>
						)}
					</h2>
					{preparedOrders.length === 0 ? (
						<p className="text-gray-500">No orders have been prepared</p>
					) : (
						<div className="space-y-3">
							{preparedOrders.map((order) => (
								<div
									key={order.orderId}
									className="rounded-lg border border-green-800 bg-green-900/20 p-4"
								>
									<OrderCard order={order} />
								</div>
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	);
}

function OrderCard({ order }: { order: OrderViewState }) {
	return (
		<dl className="flex-1 space-y-1 text-sm">
			<div>
				<dt className="inline font-medium text-gray-300">Order ID: </dt>
				<dd className="inline text-gray-400">{order.orderId}</dd>
			</div>
			<div>
				<dt className="inline font-medium text-gray-300">Restaurant ID: </dt>
				<dd className="inline text-gray-400">{order.restaurantId}</dd>
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
	);
}
