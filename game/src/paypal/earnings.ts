/**
 * Panel de ganancias del propietario (EXCLUSIVO DE SERVIDOR).
 *
 * Consulta la API de transacciones de PayPal y agrega:
 *  - Total USD capturado
 *  - Número de operaciones
 *  - Desglose por artículo (SKU)
 *
 * También incluye los registros locales de la sesión del servidor
 * (StoreService.purchases) para reflejar capturas recientes sin depender
 * del retraso de reportes de PayPal (que puede ser de minutos u horas).
 */

export interface EarningsEntry {
  transactionId: string;
  sku: string;
  amountUsd: number;
  status: string;
  timestamp: string;
}

export interface EarningsSummary {
  totalUsd: number;
  transactionCount: number;
  perSku: Array<{ sku: string; count: number; amountUsd: number }>;
  localCaptured: number;
  source: 'paypal-api' | 'local-only' | 'unavailable';
}

export interface PayPalTransaction {
  transaction_info: {
    transaction_id: string;
    transaction_status: string;
    transaction_amount?: { currency_code: string; value: string };
    transaction_initiation_date?: string;
    transaction_subject?: string;
  };
}

export class EarningsService {
  constructor(
    private readonly deps: {
      getAccessToken: () => Promise<string>;
      apiBase: string;
      fetchFn?: typeof fetch;
      localPurchases?: () => Array<{ orderId: string; sku: string; status: string }>;
    },
  ) {}

  async fetchTransactions(days = 30): Promise<EarningsEntry[]> {
    const fetchFn = this.deps.fetchFn ?? fetch;
    const token = await this.deps.getAccessToken();
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const url =
      `${this.deps.apiBase}/v1/reporting/transactions` +
      `?start_date=${encodeURIComponent(start.toISOString())}` +
      `&end_date=${encodeURIComponent(end.toISOString())}` +
      `&fields=transaction_info&page_size=100`;
    const res = await fetchFn(url, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`paypal-transactions-failed:${res.status}`);
    const data = (await res.json()) as { transaction_details?: PayPalTransaction[] };
    const entries: EarningsEntry[] = [];
    for (const t of data.transaction_details ?? []) {
      const info = t.transaction_info;
      const amount = Number(info.transaction_amount?.value ?? '0');
      if (!Number.isFinite(amount) || amount <= 0) continue;
      entries.push({
        transactionId: info.transaction_id,
        sku: info.transaction_subject ?? 'desconocido',
        amountUsd: amount,
        status: info.transaction_status,
        timestamp: info.transaction_initiation_date ?? '',
      });
    }
    return entries;
  }

  async summarize(days = 30): Promise<EarningsSummary> {
    const local = this.deps.localPurchases?.().filter((p) => p.status === 'captured') ?? [];
    try {
      const entries = await this.fetchTransactions(days);
      const perSku = new Map<string, { count: number; amountUsd: number }>();
      let totalUsd = 0;
      for (const e of entries) {
        totalUsd += e.amountUsd;
        const agg = perSku.get(e.sku) ?? { count: 0, amountUsd: 0 };
        agg.count += 1;
        agg.amountUsd += e.amountUsd;
        perSku.set(e.sku, agg);
      }
      return {
        totalUsd: round2(totalUsd),
        transactionCount: entries.length,
        perSku: [...perSku.entries()].map(([sku, v]) => ({
          sku,
          count: v.count,
          amountUsd: round2(v.amountUsd),
        })),
        localCaptured: local.length,
        source: 'paypal-api',
      };
    } catch {
      return {
        totalUsd: 0,
        transactionCount: 0,
        perSku: [],
        localCaptured: local.length,
        source: 'unavailable',
      };
    }
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
