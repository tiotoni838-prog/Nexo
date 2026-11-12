import { describe, expect, it, vi } from 'vitest';
import { PayPalClient, PayPalConfigError, loadPayPalConfig } from '../src/paypal/paypalClient.js';
import { StoreService } from '../src/paypal/storeRoutes.js';
import { STORE_CATALOG, findStoreItem } from '../src/paypal/store.js';

describe('carga de configuración PayPal', () => {
  it('falla con mensaje claro si faltan secretos en el entorno', () => {
    expect(() => loadPayPalConfig({} as NodeJS.ProcessEnv)).toThrow(PayPalConfigError);
  });

  it('nunca expone el secret en el mensaje de error', () => {
    try {
      loadPayPalConfig({ PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'SECRETO-123' } as NodeJS.ProcessEnv);
      expect.unreachable();
    } catch (err) {
      expect(String(err)).not.toContain('SECRETO-123');
    }
  });

  it('usa sandbox por defecto', () => {
    const cfg = loadPayPalConfig({
      PAYPAL_CLIENT_ID: 'id',
      PAYPAL_CLIENT_SECRET: 'sec',
    } as NodeJS.ProcessEnv);
    expect(cfg.apiBase).toContain('sandbox');
  });
});

describe('PayPalClient', () => {
  const okResponse = (body: unknown): Response =>
    new Response(JSON.stringify(body), { status: 200 });

  it('obtiene token, crea orden con idempotencia y captura', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      if (String(url).includes('/oauth2/token')) {
        return okResponse({ access_token: 'TEST-TOKEN', expires_in: 3600 });
      }
      if (String(url).endsWith('/checkout/orders')) {
        return okResponse({
          id: 'ORDER-1',
          status: 'CREATED',
          links: [{ rel: 'approve', href: 'https://paypal.test/approve' }],
        });
      }
      return okResponse({ id: 'ORDER-1', status: 'COMPLETED' });
    }) as unknown as typeof fetch;

    const client = new PayPalClient(
      { clientId: 'id', clientSecret: 'sec', apiBase: 'https://api-m.test' },
      fetchMock,
    );

    const order = await client.createOrder({
      sku: 'skin-aurora-vanguard',
      priceUsd: '4.99',
      description: 'Skin',
      referenceId: 'ref-1',
      returnUrl: 'https://game.test/return',
      cancelUrl: 'https://game.test/cancel',
      idempotencyKey: 'ref-1',
    });
    expect(order.id).toBe('ORDER-1');
    expect(order.approveUrl).toBe('https://paypal.test/approve');

    const createCall = calls.find((c) => c.url.endsWith('/checkout/orders'))!;
    expect((createCall.init.headers as Record<string, string>)['PayPal-Request-Id']).toBe('ref-1');
    const body = JSON.parse(String(createCall.init.body));
    expect(body.purchase_units[0].amount.value).toBe('4.99');
    expect(body.intent).toBe('CAPTURE');

    const captured = await client.captureOrder('ORDER-1');
    expect(captured.status).toBe('COMPLETED');

    const authHeader = (calls[0]!.init.headers as Record<string, string>).authorization;
    expect(authHeader.startsWith('Basic ')).toBe(true);
  });

  it('reutiliza el token en caché', async () => {
    let tokenCalls = 0;
    const fetchMock = vi.fn(async (url: string | URL) => {
      if (String(url).includes('/oauth2/token')) {
        tokenCalls += 1;
        return okResponse({ access_token: 'T', expires_in: 3600 });
      }
      return okResponse({ id: 'X', status: 'CREATED', links: [] });
    }) as unknown as typeof fetch;
    const client = new PayPalClient(
      { clientId: 'id', clientSecret: 'sec', apiBase: 'https://api-m.test' },
      fetchMock,
    );
    const base = {
      sku: 's',
      priceUsd: '1.00',
      description: 'd',
      referenceId: 'r',
      returnUrl: 'u',
      cancelUrl: 'c',
    };
    await client.createOrder({ ...base, idempotencyKey: 'r1' });
    await client.createOrder({ ...base, idempotencyKey: 'r2' });
    expect(tokenCalls).toBe(1);
  });
});

describe('StoreService', () => {
  it('la tienda solo vende cosméticos con precio visible', () => {
    for (const item of STORE_CATALOG) {
      expect(['skin', 'emote', 'trail']).toContain(item.kind);
      expect(item.priceUsd).toMatch(/^\d+\.\d{2}$/);
      expect(findStoreItem(item.sku)).toBeDefined();
    }
  });

  it('queda desactivada sin credenciales y responde el motivo sin secretos', () => {
    const store = new StoreService({} as NodeJS.ProcessEnv);
    expect(store.available).toBe(false);
    expect(() => store.createPurchase('skin-aurora-vanguard', 'http://x')).rejects.toThrow();
  });
});
