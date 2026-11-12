import { describe, expect, it, vi } from 'vitest';
import { EarningsService } from '../src/paypal/earnings.js';

const fetchOk = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

describe('panel de ganancias', () => {
  it('agrega el total y el desglose por SKU desde la API de PayPal', async () => {
    const svc = new EarningsService({
      getAccessToken: async () => 'token-de-prueba',
      apiBase: 'https://api-m.sandbox.paypal.com',
      fetchFn: fetchOk({
        transaction_details: [
          {
            transaction_info: {
              transaction_id: 'TX1',
              transaction_status: 'C',
              transaction_amount: { currency_code: 'USD', value: '4.99' },
              transaction_subject: 'skin-aurora-vanguard',
              transaction_initiation_date: '2026-01-01T00:00:00Z',
            },
          },
          {
            transaction_info: {
              transaction_id: 'TX2',
              transaction_status: 'C',
              transaction_amount: { currency_code: 'USD', value: '2.99' },
              transaction_subject: 'skin-quartz-drifter',
            },
          },
          {
            transaction_info: {
              transaction_id: 'TX3',
              transaction_status: 'C',
              transaction_amount: { currency_code: 'USD', value: '-1.00' },
              transaction_subject: 'reembolso',
            },
          },
        ],
      }),
    });
    const summary = await svc.summarize(30);
    expect(summary.source).toBe('paypal-api');
    expect(summary.transactionCount).toBe(2);
    expect(summary.totalUsd).toBe(7.98);
    expect(summary.perSku).toHaveLength(2);
  });

  it('degrada con gracia si la API falla y muestra capturas locales', async () => {
    const svc = new EarningsService({
      getAccessToken: async () => 'token-de-prueba',
      apiBase: 'https://api-m.sandbox.paypal.com',
      fetchFn: vi.fn(async () => new Response('denied', { status: 401 })),
      localPurchases: () => [{ orderId: 'o1', sku: 'emote-nexo-salute', status: 'captured' }],
    });
    const summary = await svc.summarize(30);
    expect(summary.source).toBe('unavailable');
    expect(summary.localCaptured).toBe(1);
  });

  it('pide el token antes de consultar transacciones', async () => {
    let tokenAsked = 0;
    const svc = new EarningsService({
      getAccessToken: async () => {
        tokenAsked += 1;
        return 'tk';
      },
      apiBase: 'https://api-m.sandbox.paypal.com',
      fetchFn: fetchOk({ transaction_details: [] }),
    });
    await svc.summarize(7);
    expect(tokenAsked).toBe(1);
  });
});
