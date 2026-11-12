/**
 * Integración PayPal EXCLUSIVA DE SERVIDOR.
 *
 * REGLA DE SEGURIDAD (spec maestra): el client ID y el client secret de PayPal
 * NUNCA se escriben en el código, el cliente web, el APK ni el historial Git.
 * Se leen únicamente de variables de entorno del proceso servidor:
 *
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
 *   PAYPAL_API_BASE (opcional; por defecto sandbox)
 *
 * Este módulo no debe importarse nunca desde src/client.
 */

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  apiBase: string;
}

export interface PayPalOrder {
  id: string;
  status: string;
  approveUrl: string | null;
}

export class PayPalConfigError extends Error {}

export const loadPayPalConfig = (env: NodeJS.ProcessEnv = process.env): PayPalConfig => {
  const clientId = env.PAYPAL_CLIENT_ID;
  const clientSecret = env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new PayPalConfigError(
      'Faltan PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET en el entorno del servidor. ' +
        'No las escribas nunca en el código ni en el chat: configúralas como variables de entorno o secretos del despliegue.',
    );
  }
  return {
    clientId,
    clientSecret,
    apiBase: env.PAYPAL_API_BASE ?? 'https://api-m.sandbox.paypal.com',
  };
};

interface TokenCache {
  token: string;
  expiresAtMs: number;
}

export class PayPalClient {
  private tokenCache: TokenCache | null = null;

  constructor(private readonly config: PayPalConfig, private readonly fetchFn: typeof fetch = fetch) {}

  async getAccessToken(nowMs = Date.now()): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAtMs - 60_000 > nowMs) {
      return this.tokenCache.token;
    }
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const res = await this.fetchFn(`${this.config.apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      throw new Error(`paypal-auth-failed:${res.status}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.tokenCache = {
      token: data.access_token,
      expiresAtMs: nowMs + data.expires_in * 1000,
    };
    return data.access_token;
  }

  async createOrder(input: {
    sku: string;
    priceUsd: string;
    description: string;
    referenceId: string;
    returnUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
  }): Promise<PayPalOrder> {
    const token = await this.getAccessToken(Date.now());
    const res = await this.fetchFn(`${this.config.apiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'PayPal-Request-Id': input.idempotencyKey,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: input.referenceId,
            custom_id: input.sku,
            description: input.description.slice(0, 127),
            amount: { currency_code: 'USD', value: input.priceUsd },
          },
        ],
        application_context: {
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
          shipping_preference: 'NO_SHIPPING',
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`paypal-create-order-failed:${res.status}`);
    }
    const data = (await res.json()) as {
      id: string;
      status: string;
      links: Array<{ rel: string; href: string }>;
    };
    return {
      id: data.id,
      status: data.status,
      approveUrl: data.links.find((l) => l.rel === 'approve')?.href ?? null,
    };
  }

  async captureOrder(orderId: string): Promise<{ id: string; status: string }> {
    const token = await this.getAccessToken(Date.now());
    const res = await this.fetchFn(`${this.config.apiBase}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) {
      throw new Error(`paypal-capture-failed:${res.status}`);
    }
    const data = (await res.json()) as { id: string; status: string };
    return { id: data.id, status: data.status };
  }
}
