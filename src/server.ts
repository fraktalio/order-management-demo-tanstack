import handler from '@tanstack/react-start/server-entry';

export default {
	fetch: handler.fetch,
};

// Re-export workflow class — Cloudflare requires it from the entrypoint
export { PaymentWorkflow } from './application/workflows/paymentWorkflow';
