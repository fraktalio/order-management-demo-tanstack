// Command handlers
export { createRestaurantHandler } from './command-handlers/createRestaurant.ts';
export { changeRestaurantMenuHandler } from './command-handlers/changeRestaurantMenu.ts';
export { placeOrderHandler } from './command-handlers/placeOrder.ts';
export { markOrderPaidHandler } from './command-handlers/markOrderPaid.ts';
export { markOrderPaymentFailedHandler } from './command-handlers/markOrderPaymentFailed.ts';
export { markOrderAsPreparedHandler } from './command-handlers/markOrderAsPrepared.ts';

// Query handlers
export { restaurantQueryHandler } from './query-handlers/restaurantQuery.ts';
export { orderQueryHandler } from './query-handlers/orderQuery.ts';

// API helpers
export { handleCommand, json } from './api.ts';
