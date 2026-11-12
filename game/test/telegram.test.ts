import { describe, expect, it } from 'vitest';
import {
  buildOwnerMessage,
  sendTelegramMessage,
  telegramConfigFromEnv,
  type OwnerEvent,
} from '../src/server/telegram.js';
import { renderDownloadPage, downloadPagePath, DOWNLOAD_PLATFORMS } from '../src/server/downloadPages.js';
import { GAME_VERSION } from '../src/shared/version.js';

describe('notificaciones Telegram al propietario', () => {
  it('sin credenciales devuelve null y no notifica', () => {
    expect(telegramConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    expect(telegramConfigFromEnv({ TELEGRAM_BOT_TOKEN: 'solo-token' } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('lee el token y el chat del entorno', () => {
    const cfg = telegramConfigFromEnv({ TELEGRAM_BOT_TOKEN: 'tk', TELEGRAM_CHAT_ID: '42' } as NodeJS.ProcessEnv);
    expect(cfg).toEqual({ botToken: 'tk', chatId: '42' });
  });

  it('construye mensajes legibles para cada evento', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0);
    const ban: OwnerEvent = { kind: 'ban', accountId: 'a1', reason: 'speedhack', untilMs: 0 };
    const msg = buildOwnerMessage(ban, now);
    expect(msg).toContain('BANEO');
    expect(msg).toContain('speedhack');
    expect(msg).toContain('permanente');

    const sale: OwnerEvent = { kind: 'purchase', sku: 'dalo-1000', amount: '4.99', currency: 'USD', orderId: 'o1' };
    expect(buildOwnerMessage(sale, now)).toContain('4.99 USD');

    const report: OwnerEvent = { kind: 'report', reportedId: 'x', reporterId: 'y', reason: 'insultos' };
    expect(buildOwnerMessage(report, now)).toContain('insultos');

    const summary: OwnerEvent = { kind: 'daily-summary', totalUsd: '120.50', operations: 34, days: 7 };
    expect(buildOwnerMessage(summary, now)).toContain('120.50');
  });

  it('sendTelegramMessage usa la API de BotFather y no lanza en error de red', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    const ok = await sendTelegramMessage({ botToken: 'TK', chatId: '42' }, 'hola', fakeFetch);
    expect(ok).toBe(true);
    expect(calls[0].url).toBe('https://api.telegram.org/botTK/sendMessage');
    expect((calls[0].init?.body as string)).toContain('"chat_id":"42"');

    const failing = (async () => {
      throw new Error('network');
    }) as typeof fetch;
    await expect(sendTelegramMessage({ botToken: 'TK', chatId: '42' }, 'hola', failing)).resolves.toBe(false);
  });
});

describe('páginas de descarga por plataforma', () => {
  it('reconoce las 7 plataformas y rechaza otras rutas', () => {
    expect(DOWNLOAD_PLATFORMS).toHaveLength(7);
    expect(downloadPagePath('/download/windows')).toBe('windows');
    expect(downloadPagePath('/download/ios')).toBe('ios');
    expect(downloadPagePath('/download/no-existe')).toBeNull();
    expect(downloadPagePath('/download')).toBeNull();
    expect(downloadPagePath('/download/windows/extra')).toBeNull();
  });

  it('cada plataforma tiene instrucciones propias y versión actual', () => {
    for (const p of DOWNLOAD_PLATFORMS) {
      const html = renderDownloadPage(p, 'http://localhost:8080');
      expect(html).toContain(GAME_VERSION);
      expect(html).toContain('descargar y jugar');
      expect(html).toContain('/download/');
    }
  });

  it('windows y linux enlazan su ZIP nativo; android/ios explican la vía de tienda', () => {
    const win = renderDownloadPage('windows', 'http://x');
    expect(win).toContain(`NexoFPS-${GAME_VERSION}-windows-x64.zip`);
    expect(win).toContain('nexo-fps.exe');
    const linux = renderDownloadPage('linux', 'http://x');
    expect(linux).toContain(`NexoFPS-${GAME_VERSION}-linux-x64.zip`);
    const android = renderDownloadPage('android', 'http://x');
    expect(android).toContain('Play Store');
    const ios = renderDownloadPage('ios', 'http://x');
    expect(ios).toContain('Xcode');
  });
});
