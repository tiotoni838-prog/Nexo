import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { loadPayPalConfig, PayPalClient, PayPalConfigError } from './paypalClient.js';
import { STORE_CATALOG, findStoreItem } from './store.js';

/**
 * Rutas HTTP de la tienda. Se montan en el proceso SERVIDOR (main.ts), nunca
 * en el cliente. Si las credenciales PayPal no están configuradas, la tienda
 * responde 503 con un mensaje claro y el resto del juego sigue funcionando.
 */

export interface StorePurchaseRecord {
  orderId: string;
  sku: string;
  status: 'created' | 'captured' | 'failed';
  createdAt: number;
}

export class StoreService {
  private paypal: PayPalClient | null = null;
  private configError: string | null = null;
  readonly purchases = new Map<string, StorePurchaseRecord>();

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    try {
      this.paypal = new PayPalClient(loadPayPalConfig(env));
    } catch (err) {
      this.configError = err instanceof PayPalConfigError ? err.message : String(err);
    }
  }

  get available(): boolean {
    return this.paypal !== null;
  }

  catalog() {
    return STORE_CATALOG.map(({ sku, nameEs, nameEn, priceUsd, kind, rarity }) => ({
      sku,
      nameEs,
      nameEn,
      priceUsd,
      kind,
      rarity,
    }));
  }

  async createPurchase(sku: string, baseUrl: string): Promise<{ orderId: string; approveUrl: string | null }> {
    if (!this.paypal) throw new PayPalConfigError(this.configError ?? 'paypal-not-configured');
    const item = findStoreItem(sku);
    if (!item) throw new Error('sku-not-found');
    const orderId = randomUUID();
    const order = await this.paypal.createOrder({
      sku: item.sku,
      priceUsd: item.priceUsd,
      description: cosmeticDescription(item.nameEs),
      referenceId: orderId,
      returnUrl: `${baseUrl}/api/store/return`,
      cancelUrl: `${baseUrl}/api/store/cancel`,
      idempotencyKey: orderId,
    });
    this.purchases.set(order.id, {
      orderId: order.id,
      sku,
      status: 'created',
      createdAt: Date.now(),
    });
    return { orderId: order.id, approveUrl: order.approveUrl };
  }

  async capture(token: string): Promise<StorePurchaseRecord> {
    if (!this.paypal) throw new PayPalConfigError(this.configError ?? 'paypal-not-configured');
    const record = this.purchases.get(token);
    if (!record) throw new Error('order-not-found');
    const result = await this.paypal.captureOrder(token);
    record.status = result.status === 'COMPLETED' ? 'captured' : 'failed';
    return record;
  }
}

const cosmeticDescription = (name: string): string => `NEXO FRONTIER cosmético: ${name}`;

export const mountStoreRoutes = (
  server: http.Server,
  store: StoreService,
): void => {
  const json = (res: http.ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  server.on('request', (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/store')) return;

    if (url.pathname === '/api/store/catalog' && req.method === 'GET') {
      json(res, 200, { items: store.catalog() });
      return;
    }

    if (url.pathname === '/api/store/purchase' && req.method === 'POST') {
      if (!store.available) {
        json(res, 503, {
          error: 'store-not-configured',
          msg: 'Configura PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET como variables de entorno del servidor (nunca en el código).',
        });
        return;
      }
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 4096) req.destroy();
      });
      req.on('end', () => {
        try {
          const { sku } = JSON.parse(body) as { sku?: string };
          if (!sku) {
            json(res, 400, { error: 'sku-required' });
            return;
          }
          const baseUrl = `${url.protocol}//${url.host}`;
          void store
            .createPurchase(sku, baseUrl)
            .then((r) => json(res, 201, r))
            .catch((err: Error) => json(res, 400, { error: err.message }));
        } catch {
          json(res, 400, { error: 'bad-json' });
        }
      });
      return;
    }

    if (url.pathname === '/api/store/return' && req.method === 'GET') {
      const token = url.searchParams.get('token');
      if (!token) {
        json(res, 400, { error: 'token-required' });
        return;
      }
      void store
        .capture(token)
        .then((r) => json(res, 200, { status: r.status, sku: r.sku }))
        .catch((err: Error) => json(res, 400, { error: err.message }));
      return;
    }

    if (url.pathname === '/api/store/cancel') {
      json(res, 200, { status: 'cancelled' });
      return;
    }

    json(res, 404, { error: 'not-found' });
  });
};
