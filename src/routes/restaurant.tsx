import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { useState } from 'react';
import { withDb } from '@/infrastructure/db';
import { createRestaurantHandler } from '@/application/command-handlers/createRestaurant.ts';
import { changeRestaurantMenuHandler } from '@/application/command-handlers/changeRestaurantMenu.ts';
import { restaurantQueryHandler } from '@/application/query-handlers/restaurantQuery.ts';
import {
	restaurantId,
	restaurantMenuId,
	menuItemId,
	type RestaurantMenuCuisine,
	type MenuItem,
} from '@/domain/api.ts';
import type { RestaurantViewState } from '@/domain/views/restaurantView.ts';
import { UtensilsCrossed, Plus, Trash2 } from 'lucide-react';

// ─── Server Functions ───────────────────────────────────────────────

type CreateRestaurantInput = {
	restaurantId: string;
	name: string;
	cuisine: RestaurantMenuCuisine;
	menuItems: { name: string; price: string }[];
};

const createRestaurant = createServerFn({ method: 'POST' })
	.inputValidator((input: CreateRestaurantInput) => input)
	.handler(async ({ data }) => {
		return withDb(env, (sql) => {
			const handler = createRestaurantHandler(sql);
			return handler.handle({
				kind: 'CreateRestaurantCommand',
				restaurantId: restaurantId(data.restaurantId || crypto.randomUUID()),
				name: data.name,
				menu: {
					menuId: restaurantMenuId(crypto.randomUUID()),
					cuisine: data.cuisine,
					menuItems: data.menuItems.map((item) => ({
						menuItemId: menuItemId(crypto.randomUUID()),
						name: item.name,
						price: item.price,
					})),
				},
			});
		});
	});

type ChangeMenuInput = {
	restaurantId: string;
	cuisine: RestaurantMenuCuisine;
	menuItems: { name: string; price: string }[];
};

const changeMenu = createServerFn({ method: 'POST' })
	.inputValidator((input: ChangeMenuInput) => input)
	.handler(async ({ data }) => {
		return withDb(env, (sql) => {
			const handler = changeRestaurantMenuHandler(sql);
			return handler.handle({
				kind: 'ChangeRestaurantMenuCommand',
				restaurantId: restaurantId(data.restaurantId),
				menu: {
					menuId: restaurantMenuId(crypto.randomUUID()),
					cuisine: data.cuisine,
					menuItems: data.menuItems.map((item) => ({
						menuItemId: menuItemId(crypto.randomUUID()),
						name: item.name,
						price: item.price,
					})),
				},
			});
		});
	});

const fetchRestaurant = createServerFn({ method: 'POST' })
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

// ─── Route ──────────────────────────────────────────────────────────

export const Route = createFileRoute('/restaurant')({
	component: RestaurantPage,
});

// ─── Page ───────────────────────────────────────────────────────────

function RestaurantPage() {
	return (
		<div className="min-h-screen bg-slate-900 p-8 text-white">
			<div className="mx-auto max-w-3xl">
				<div className="mb-8 flex items-center gap-3">
					<UtensilsCrossed className="h-8 w-8 text-cyan-400" />
					<h1 className="text-3xl font-bold">Restaurant Management</h1>
				</div>
				<div className="space-y-12">
					<CreateRestaurantForm />
					<hr className="border-slate-700" />
					<ChangeMenuForm />
				</div>
			</div>
		</div>
	);
}

// ─── Create Restaurant Form ─────────────────────────────────────────

const CUISINE_OPTIONS: RestaurantMenuCuisine[] = [
	'GENERAL',
	'SERBIAN',
	'ITALIAN',
	'MEXICAN',
	'CHINESE',
	'INDIAN',
	'FRENCH',
];

type MenuItemRow = { name: string; price: string };
type Status = { type: 'idle' | 'loading' | 'success' | 'error'; message?: string };

function CreateRestaurantForm() {
	const [rid, setRid] = useState('');
	const [name, setName] = useState('');
	const [cuisine, setCuisine] = useState<RestaurantMenuCuisine>('GENERAL');
	const [menuItems, setMenuItems] = useState<MenuItemRow[]>([{ name: '', price: '' }]);
	const [status, setStatus] = useState<Status>({ type: 'idle' });

	const updateItem = (i: number, field: 'name' | 'price', value: string) =>
		setMenuItems((items) =>
			items.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)),
		);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setStatus({ type: 'loading' });
		try {
			await createRestaurant({
				data: { restaurantId: rid, name, cuisine, menuItems },
			});
			setStatus({ type: 'success', message: 'Restaurant created successfully' });
			setRid('');
			setName('');
			setCuisine('GENERAL');
			setMenuItems([{ name: '', price: '' }]);
		} catch (err) {
			setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Request failed' });
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<h2 className="text-xl font-semibold">Create Restaurant</h2>
			{status.type === 'success' && <p className="text-green-400">{status.message}</p>}
			{status.type === 'error' && <p className="text-red-400">{status.message}</p>}

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label htmlFor="create-name" className="block text-sm font-medium text-gray-300">
						Restaurant Name
					</label>
					<input
						id="create-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
					/>
				</div>
				<div>
					<label htmlFor="create-id" className="block text-sm font-medium text-gray-300">
						Restaurant ID
					</label>
					<input
						id="create-id"
						type="text"
						value={rid}
						onChange={(e) => setRid(e.target.value)}
						placeholder="auto-generated if empty"
						className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
					/>
				</div>
			</div>

			<div>
				<label htmlFor="create-cuisine" className="block text-sm font-medium text-gray-300">
					Cuisine
				</label>
				<select
					id="create-cuisine"
					value={cuisine}
					onChange={(e) => setCuisine(e.target.value as RestaurantMenuCuisine)}
					className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
				>
					{CUISINE_OPTIONS.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
			</div>

			<fieldset className="space-y-2">
				<legend className="text-sm font-medium text-gray-300">Menu Items</legend>
				{menuItems.map((item, i) => (
					<div key={i} className="flex items-end gap-2">
						<div className="flex-1">
							<label htmlFor={`create-item-name-${i}`} className="block text-xs text-gray-400">
								Name
							</label>
							<input
								id={`create-item-name-${i}`}
								type="text"
								value={item.name}
								onChange={(e) => updateItem(i, 'name', e.target.value)}
								required
								className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
							/>
						</div>
						<div className="w-28">
							<label htmlFor={`create-item-price-${i}`} className="block text-xs text-gray-400">
								Price
							</label>
							<input
								id={`create-item-price-${i}`}
								type="text"
								value={item.price}
								onChange={(e) => updateItem(i, 'price', e.target.value)}
								required
								className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
							/>
						</div>
						<button
							type="button"
							onClick={() => setMenuItems((items) => items.filter((_, idx) => idx !== i))}
							disabled={menuItems.length <= 1}
							className="rounded-lg p-2 text-red-400 transition-colors hover:bg-slate-800 disabled:opacity-30"
							aria-label="Remove menu item"
						>
							<Trash2 size={18} />
						</button>
					</div>
				))}
				<button
					type="button"
					onClick={() => setMenuItems((items) => [...items, { name: '', price: '' }])}
					className="flex items-center gap-1 text-sm text-cyan-400 transition-colors hover:text-cyan-300"
				>
					<Plus size={16} /> Add Menu Item
				</button>
			</fieldset>

			<button
				type="submit"
				disabled={status.type === 'loading'}
				className="rounded-lg bg-cyan-500 px-6 py-2 font-semibold transition-colors hover:bg-cyan-600 disabled:opacity-50"
			>
				{status.type === 'loading' ? 'Creating…' : 'Create Restaurant'}
			</button>
		</form>
	);
}

// ─── Change Menu Form ───────────────────────────────────────────────

function ChangeMenuForm() {
	const [rid, setRid] = useState('');
	const [cuisine, setCuisine] = useState<RestaurantMenuCuisine>('GENERAL');
	const [menuItems, setMenuItems] = useState<MenuItemRow[]>([{ name: '', price: '' }]);
	const [status, setStatus] = useState<Status>({ type: 'idle' });
	const [restaurant, setRestaurant] = useState<RestaurantViewState | null>(null);

	const updateItem = (i: number, field: 'name' | 'price', value: string) =>
		setMenuItems((items) =>
			items.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)),
		);

	const loadRestaurant = async () => {
		if (!rid.trim()) return;
		setStatus({ type: 'loading' });
		try {
			const data = await fetchRestaurant({ data: rid });
			if (data) {
				setRestaurant(data);
				setCuisine(data.menu.cuisine);
				setMenuItems(
					data.menu.menuItems.map((item: MenuItem) => ({ name: item.name, price: item.price })),
				);
				setStatus({ type: 'idle' });
			} else {
				setStatus({ type: 'error', message: 'Restaurant not found' });
			}
		} catch (err) {
			setStatus({
				type: 'error',
				message: err instanceof Error ? err.message : 'Failed to load restaurant',
			});
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setStatus({ type: 'loading' });
		try {
			await changeMenu({ data: { restaurantId: rid, cuisine, menuItems } });
			setStatus({ type: 'success', message: 'Menu updated successfully' });
		} catch (err) {
			setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Request failed' });
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<h2 className="text-xl font-semibold">Change Restaurant Menu</h2>
			{status.type === 'success' && <p className="text-green-400">{status.message}</p>}
			{status.type === 'error' && <p className="text-red-400">{status.message}</p>}

			<div className="flex items-end gap-2">
				<div className="flex-1">
					<label htmlFor="change-id" className="block text-sm font-medium text-gray-300">
						Restaurant ID
					</label>
					<input
						id="change-id"
						type="text"
						value={rid}
						onChange={(e) => setRid(e.target.value)}
						required
						className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
					/>
				</div>
				<button
					type="button"
					onClick={loadRestaurant}
					disabled={status.type === 'loading'}
					className="rounded-lg bg-slate-700 px-4 py-2 font-medium transition-colors hover:bg-slate-600 disabled:opacity-50"
				>
					Load
				</button>
			</div>

			{restaurant && <p className="text-sm text-gray-400">Loaded: {restaurant.name}</p>}

			<div>
				<label htmlFor="change-cuisine" className="block text-sm font-medium text-gray-300">
					Cuisine
				</label>
				<select
					id="change-cuisine"
					value={cuisine}
					onChange={(e) => setCuisine(e.target.value as RestaurantMenuCuisine)}
					className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
				>
					{CUISINE_OPTIONS.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
			</div>

			<fieldset className="space-y-2">
				<legend className="text-sm font-medium text-gray-300">Menu Items</legend>
				{menuItems.map((item, i) => (
					<div key={i} className="flex items-end gap-2">
						<div className="flex-1">
							<label htmlFor={`change-item-name-${i}`} className="block text-xs text-gray-400">
								Name
							</label>
							<input
								id={`change-item-name-${i}`}
								type="text"
								value={item.name}
								onChange={(e) => updateItem(i, 'name', e.target.value)}
								required
								className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
							/>
						</div>
						<div className="w-28">
							<label htmlFor={`change-item-price-${i}`} className="block text-xs text-gray-400">
								Price
							</label>
							<input
								id={`change-item-price-${i}`}
								type="text"
								value={item.price}
								onChange={(e) => updateItem(i, 'price', e.target.value)}
								required
								className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus:border-cyan-500 focus:outline-none"
							/>
						</div>
						<button
							type="button"
							onClick={() => setMenuItems((items) => items.filter((_, idx) => idx !== i))}
							disabled={menuItems.length <= 1}
							className="rounded-lg p-2 text-red-400 transition-colors hover:bg-slate-800 disabled:opacity-30"
							aria-label="Remove menu item"
						>
							<Trash2 size={18} />
						</button>
					</div>
				))}
				<button
					type="button"
					onClick={() => setMenuItems((items) => [...items, { name: '', price: '' }])}
					className="flex items-center gap-1 text-sm text-cyan-400 transition-colors hover:text-cyan-300"
				>
					<Plus size={16} /> Add Menu Item
				</button>
			</fieldset>

			<button
				type="submit"
				disabled={status.type === 'loading'}
				className="rounded-lg bg-cyan-500 px-6 py-2 font-semibold transition-colors hover:bg-cyan-600 disabled:opacity-50"
			>
				{status.type === 'loading' ? 'Updating…' : 'Update Menu'}
			</button>
		</form>
	);
}
