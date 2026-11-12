/* Notificaciones al propietario vía Telegram (BotFather).
 * Configuración opcional por entorno:
 *   TELEGRAM_BOT_TOKEN — token del bot creado con @BotFather
 *   TELEGRAM_CHAT_ID   — chat del propietario (obtenido con /start y getUpdates)
 * Sin credenciales el módulo es un no-op silencioso: el juego funciona igual.
 */

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export const telegramConfigFromEnv = (env: NodeJS.ProcessEnv = process.env): TelegramConfig | null => {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
};

export type OwnerEvent =
  | { kind: 'ban'; accountId: string; reason: string; untilMs: number }
  | { kind: 'unban'; accountId: string }
  | { kind: 'report'; reportedId: string; reporterId: string; reason: string }
  | { kind: 'purchase'; sku: string; amount: string; currency: string; orderId: string }
  | { kind: 'redeem'; code: string; accountId: string; reward: string }
  | { kind: 'daily-summary'; totalUsd: string; operations: number; days: number };

const fmtDate = (ms: number): string => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

export const buildOwnerMessage = (event: OwnerEvent, nowMs = Date.now()): string => {
  const stamp = fmtDate(nowMs);
  switch (event.kind) {
    case 'ban':
      return [
        `🚫 BANEO — ${stamp}`,
        `Cuenta: ${event.accountId}`,
        `Motivo: ${event.reason}`,
        `Hasta: ${event.untilMs === 0 ? 'permanente' : fmtDate(event.untilMs)}`,
        `Acción: revisa /admin y el canal #registro-de-sanciones`,
      ].join('\n');
    case 'unban':
      return `✅ Cuenta rehabilitada: ${event.accountId} — ${stamp}`;
    case 'report':
      return [
        `🚩 REPORTE DE JUGADOR — ${stamp}`,
        `Infractor: ${event.reportedId}`,
        `Reportado por: ${event.reporterId}`,
        `Motivo: ${event.reason}`,
        `Acción: revisa reportes en /admin antes de sancionar`,
      ].join('\n');
    case 'purchase':
      return [
        `💰 VENTA — ${stamp}`,
        `Artículo: ${event.sku}`,
        `Importe: ${event.amount} ${event.currency}`,
        `Orden PayPal: ${event.orderId}`,
      ].join('\n');
    case 'redeem':
      return `🎁 Canje: ${event.code} por ${event.accountId} → ${event.reward} — ${stamp}`;
    case 'daily-summary':
      return [
        `📊 RESUMEN DE GANANCIAS — ${stamp}`,
        `Periodo: últimos ${event.days} días`,
        `Total: ${event.totalUsd} USD en ${event.operations} operaciones`,
        `Detalle: /admin`,
      ].join('\n');
  }
};

export const sendTelegramMessage = async (
  config: TelegramConfig,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> => {
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: config.chatId, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

let activeConfig: TelegramConfig | null = null;

export const initTelegramFromEnv = (env: NodeJS.ProcessEnv = process.env): boolean => {
  activeConfig = telegramConfigFromEnv(env);
  return activeConfig !== null;
};

export const telegramActive = (): boolean => activeConfig !== null;

/** Envío fire-and-forget: nunca lanza ni bloquea la petición del jugador. */
export const notifyOwner = (event: OwnerEvent, nowMs = Date.now()): void => {
  if (!activeConfig) return;
  const text = buildOwnerMessage(event, nowMs);
  void sendTelegramMessage(activeConfig, text).catch(() => undefined);
};
