import type { Express, Request, Response } from "express";

// Loyverse live ingestion is retired. Historical Loyverse records remain untouched.
// The endpoint is kept as an explicit tombstone so old webhook deliveries cannot mutate data.
export function setupWebhooks(app: Express) {
  app.post('/api/webhooks/loyverse', (_req: Request, res: Response) => {
    return res.status(410).json({
      ok: false,
      disabled: true,
      source: 'sbb_pos_core',
      message: 'Loyverse live webhook ingestion is retired. SBB POS is the live source of truth.',
    });
  });
  console.log('[Loyverse] Webhook ingestion disabled — historical data retained');
}

export async function registerWebhooks() {
  return { disabled: true, source: 'sbb_pos_core' };
}

export async function listWebhooks() {
  return [];
}
