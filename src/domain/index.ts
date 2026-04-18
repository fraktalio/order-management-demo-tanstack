// Domain API — types, commands, events, errors
export * from './api.ts';

// Deciders
export { createRestaurantDecider } from './deciders/createRestaurant.ts';
export type { CreateRestaurantState } from './deciders/createRestaurant.ts';
export { changeRestaurantMenuDecider } from './deciders/changeRestaurantMenu.ts';
export { placeOrderDecider } from './deciders/placeOrder.ts';
export { markOrderAsPreparedDecider } from './deciders/markOrderAsPrepared.ts';

// Views
export { restaurantView } from './views/restaurantView.ts';
export type { RestaurantViewState, RestaurantEvent } from './views/restaurantView.ts';
export { orderView } from './views/orderView.ts';
export type { OrderViewState } from './views/orderView.ts';
