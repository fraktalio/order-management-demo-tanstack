import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { useState } from 'react';
import { withDb } from '@/infrastructure/db';
import { placeOrderHandler } from '@/application/command-handlers/placeOrder.ts';
import { restaurantQueryHandler } from '@/application/query-handlers/restaurantQuery.ts';
import { orderQueryHandler } from '@/application/query-handlers/orderQuery.ts';
import { restaurantId, orderId, menuItemId, type MenuItem } from '@/domain/api.ts';
import type { RestaurantViewState } from '@/domain/views/restaurantView.ts';
import type { OrderViewState } from '@/domain/views/orderView.ts';
import { ShoppingCart, Search, ClipboardCopy, Check } from 'lucide-react';

// ─── Server Functions ───────────────────────────────────────────────

type PlaceOrderInput = {
	restaurantId: string;
	orderId: string;
	menuItems: { menuItemId: string; name: string; price: string }[];
};

const placeOrder = createServerFn({ method: 'POST' })
	.inputValidator((input: PlaceOrderInput) => input)
	.handler(async ({ data }) => {
		return withDb(env, (sql) => {
			const handler = placeOrderHandler(sql);
			return handler.handle({
				kind: 'PlaceOrderCommand',
				restaurantId: restaurantId(data.restaurantId),
				orderId: orderId(data.orderId || crypto.randomUUID()),
				menuItems: data.menuItems.map((item) => ({
					menuItemId: menuItemId(item.menuItemId),
					name: item.name,
					price: item.price,
				})),
			});
		});
	});

const fetchRestaurantForOrder = createServerFn({ method: 'POST' })
	.inputValidator((input: string) => input)
	.handler(async ({ data: rid }) => {
		return withDb(env, (sql) => {
			const handler = restaurantQueryHandler(sql);
			return handler.handle([
				['restaurantId:' + rid, 'RestaurantCreatedEvent'],
				['restaurantId:' + rid, 'RestaurantMenuChangedEvent'],
			]);
		});
	});

const fetchOrder = createServerFn({ method: 'POST' })
	.inputValidator((input: { orderId: string; restaurantId: string }) => input)
	.handler(async ({ data }) => {
		return withDb(env, (sql) => {
			const handler = orderQueryHandler(sql);
			return handler.handle([
				[
					'restaurantId:' + data.restaurantId,
					'orderId:' + data.orderId,
					'RestaurantOrderPlacedEvent',
				],
				['orderId:' + data.orderId, 'OrderPreparedEvent'],
			]);
		});
	});

// ─── Route ──────────────────────────────────────────────────────────

export const Route = createFileRoute('/order')({
	component: OrderPage,
});

// ─── Page ───────────────────────────────────────────────────────────

function OrderPage() {
	return (
		<div className="min-h-screen bg-slate-900 p-8 text-white">
			<div className="mx-auto max-w-3xl">
				<div className="mb-8 flex items-center gap-3">
					<ShoppingCart className="h-8 w-8 text-cyan-400" />
					<h1 className="text-3xl font-bold">Order Management</h1>
				</div>
				<div className="space-y-12">
					<PlaceOrderForm />
					<hr className="border-slate-700" />
					<OrderStatusTracker />
				</div>
			</div>
		</div>
	);
}

// ─── Place Order Form ───────────────────────────────────────────────

type Status = { type: 'idle' | 'loading' | 'success' | 'error'; message?: string };

function PlaceOrderForm() {
	const [rid, setRid] = useState('');
	const [oid, setOid] = useState(() => crypto.randomUUID());
	const [restaurant, setRestaurant] = useState<RestaurantViewState | null>(null);
	const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
	const [menuStatus, setMenuStatus] = useState<Status>({ type: 'idle' });
	const [status, setStatus] = useState<Status>({ type: 'idle' });
	const [copied, setCopied] = useState(false);

	const loadMenu = async () => {
		if (!rid.trim()) return;
		setMenuStatus({ type: 'loading' });
		setRestaurant(null);
		setSelectedItems(new Set());
		try {
			const data = await fetchRestaurantForOrder({ data: rid });
			if (data) {
				setRestaurant(data);
				setMenuStatus({ type: 'success' });
			} else {
				setMenuStatus({ type: 'error', message: 'Restaurant not found' });
			}
		} catch (err) {
			setMenuStatus({
				type: 'error',
				message: err instanceof Error ? err.message : 'Failed to load menu',
			});
		}
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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!restaurant) return;
		const chosen = restaurant.menu.menuItems.filter((item) => selectedItems.has(item.menuItemId));
		if (chosen.length === 0) {
			setStatus({ type: 'error', message: 'Select at least one menu item' });
			return;
		}
		setStatus({ type: 'loading' });
		try {
			await placeOrder({
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
			setStatus({ type: 'success', message: 'Order placed successfully' });
			setRid('');
			setOid(crypto.randomUUID());
			setRestaurant(null);
			setSelectedItems(new Set());
			setMenuStatus({ type: 'idle' });
		} catch (err) {
			setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Request failed' });
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<h2 className="text-xl font-semibold">Place Order</h2>
			{status.type === 'success' && <p className="text-green-400">{status.message}</p>}
			{status.type === 'error' && <p className="text-red-400">{status.message}</p>}

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label htmlFor="order-rid" className="block text-sm font-medium text-gray-300">
						Restaurant ID
					</label>
					<div className="mt-1 flex gap-2">
						<input
							id="order-rid"
							type="text"
							value={rid}
							onChange={(e) => setRid(e.target.value)}
							required
							className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
						/>
						<button
							type="button"
							onClick={loadMenu}
							disabled={menuStatus.type === 'loading'}
							className="rounded-lg bg-slate-700 px-4 py-2 font-medium transition-colors hover:bg-slate-600 disabled:opacity-50"
						>
							Load
						</button>
					</div>
				</div>
				<div>
					<label htmlFor="order-id" className="block text-sm font-medium text-gray-300">
						Order ID
					</label>
					<div className="mt-1 flex gap-2">
						<input
							id="order-id"
							type="text"
							value={oid}
							onChange={(e) => setOid(e.target.value)}
							required
							className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
						/>
						<button
							type="button"
							onClick={copyOrderId}
							className="rounded-lg bg-slate-700 px-3 py-2 transition-colors hover:bg-slate-600"
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

			{menuStatus.type === 'error' && <p className="text-sm text-red-400">{menuStatus.message}</p>}

			{restaurant && restaurant.menu.menuItems.length > 0 && (
				<fieldset className="space-y-2">
					<legend className="text-sm font-medium text-gray-300">
						Select Menu Items — {restaurant.name} ({restaurant.menu.cuisine})
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
										onClick={() => toggleItem(item.menuItemId)}
										className="cursor-pointer border-t border-slate-700 transition-colors hover:bg-slate-800"
									>
										<td className="px-3 py-2">
											<input
												type="checkbox"
												checked={selectedItems.has(item.menuItemId)}
												onChange={() => toggleItem(item.menuItemId)}
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

			<button
				type="submit"
				disabled={status.type === 'loading' || selectedItems.size === 0}
				className="rounded-lg bg-cyan-500 px-6 py-2 font-semibold transition-colors hover:bg-cyan-600 disabled:opacity-50"
			>
				{status.type === 'loading' ? 'Placing…' : 'Place Order'}
			</button>
		</form>
	);
}

// ─── Order Status Tracker ───────────────────────────────────────────

function OrderStatusTracker() {
	const [oid, setOid] = useState('');
	const [rid, setRid] = useState('');
	const [orderView, setOrderView] = useState<OrderViewState | null>(null);
	const [status, setStatus] = useState<Status>({ type: 'idle' });

	const trackOrder = async () => {
		if (!oid.trim() || !rid.trim()) return;
		setStatus({ type: 'loading' });
		setOrderView(null);
		try {
			const data = await fetchOrder({ data: { orderId: oid, restaurantId: rid } });
			if (data && data.orderId) {
				setOrderView(data);
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
			<h2 className="text-xl font-semibold">Track Order</h2>
			{status.type === 'error' && <p className="text-red-400">{status.message}</p>}

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label htmlFor="track-rid" className="block text-sm font-medium text-gray-300">
						Restaurant ID
					</label>
					<input
						id="track-rid"
						type="text"
						value={rid}
						onChange={(e) => setRid(e.target.value)}
						className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
					/>
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

			{orderView && (
				<div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
					<dl className="space-y-2 text-sm">
						<div>
							<dt className="font-medium text-gray-300">Order ID</dt>
							<dd className="text-gray-400">{orderView.orderId}</dd>
						</div>
						<div>
							<dt className="font-medium text-gray-300">Restaurant ID</dt>
							<dd className="text-gray-400">{orderView.restaurantId}</dd>
						</div>
						<div>
							<dt className="font-medium text-gray-300">Status</dt>
							<dd>
								<span
									className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
										orderView.status === 'PREPARED'
											? 'bg-green-900 text-green-200'
											: 'bg-amber-900 text-amber-200'
									}`}
								>
									{orderView.status}
								</span>
							</dd>
						</div>
						<div>
							<dt className="font-medium text-gray-300">Menu Items</dt>
							<dd>
								<ul className="list-disc pl-5 text-gray-400">
									{orderView.menuItems.map((item) => (
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
