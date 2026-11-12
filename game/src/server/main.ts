import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameServer, type Connection } from './gameServer.js';
import { TICK_MS, PROTOCOL_VERSION } from '../shared/constants.js';
import { GAME_NAME, GAME_VERSION } from '../shared/version.js';
import { isMapPresetId, type MapPresetId } from '../shared/map.js';
import { StoreService, handleStoreRoutes } from '../paypal/storeRoutes.js';
import { handleAdminRoutes } from '../paypal/adminRoutes.js';
import { EarningsService } from '../paypal/earnings.js';
import { loadPayPalConfig, PayPalClient, PayPalConfigError } from '../paypal/paypalClient.js';
import { handleStatic } from './serve.js';
import { AccountStore } from './accounts.js';
import { handleApiRoutes } from './apiRoutes.js';
import { initTelegramFromEnv } from './telegram.js';

const loadDotEnv = (): void => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const candidate of [path.resolve(here, '../../.env'), path.resolve(process.cwd(), '.env')]) {
    try {
      const raw = fs.readFileSync(candidate, 'utf8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch {
      /* archivo ausente: se usan solo las variables del entorno real */
    }
  }
};
loadDotEnv();

const PORT = Number(process.env.NEXO_PORT ?? 7777);
const HTTP_PORT = Number(process.env.NEXO_HTTP_PORT ?? 8080);
const MAP_ID: MapPresetId = isMapPresetId(process.env.NEXO_MAP) ? process.env.NEXO_MAP : 'nexo-urbano';

const gameServer = new GameServer({
  mode: 'online',
  botCount: Number(process.env.NEXO_BOTS ?? 7),
  minPlayersToStart: 1,
  autoStartLobbyMs: 4000,
  mapId: MAP_ID,
});

let nextConnectionId = 1;

const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

wss.on('connection', (ws: WebSocket) => {
  const id = nextConnectionId++;
  const connection: Connection = {
    id,
    send: (msg) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => ws.close(),
  };
  gameServer.addConnection(connection);

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(String(data));
      gameServer.handleRawMessage(id, parsed);
    } catch {
      ws.send(JSON.stringify({ t: 'error', code: 'bad-json', msg: 'Invalid JSON' }));
    }
  });

  ws.on('close', () => gameServer.removeConnection(id));
  ws.on('error', () => gameServer.removeConnection(id));
});

let last = Date.now();
const loop = setInterval(() => {
  const now = Date.now();
  const dt = Math.min(now - last, 250);
  last = now;
  gameServer.update(dt);
}, TICK_MS);

const store = new StoreService();
if (!store.available) {
  console.log('[nexo] tienda desactivada: define PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET en el entorno (nunca en el código)');
} else {
  console.log('[nexo] tienda PayPal activa (credenciales cargadas del entorno)');
}

const dataDir = process.env.NEXO_DATA_DIR ?? null;
const accounts = dataDir ? new AccountStore(path.join(dataDir, 'accounts.json')) : null;
if (!accounts) {
  console.log('[nexo] cuentas desactivadas: define NEXO_DATA_DIR para activar registro/login (ej. ./data)');
} else {
  console.log('[nexo] cuentas activas: datos en', dataDir);
}

if (initTelegramFromEnv()) {
  console.log('[nexo] avisos Telegram al propietario activos (banos, reportes, ventas)');
} else {
  console.log('[nexo] avisos Telegram desactivados: define TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID');
}

const adminToken = process.env.ADMIN_TOKEN ?? null;
let earnings: EarningsService | null = null;
if (store.available && adminToken) {
  try {
    const paypalConfig = loadPayPalConfig(process.env);
    const paypalClient = new PayPalClient(paypalConfig);
    earnings = new EarningsService({
      getAccessToken: () => paypalClient.getAccessToken(),
      apiBase: paypalConfig.apiBase,
      localPurchases: () =>
        [...store.purchases.values()].map((p) => ({
          orderId: p.orderId,
          sku: p.sku,
          status: p.status,
        })),
    });
  } catch (err) {
    if (!(err instanceof PayPalConfigError)) throw err;
  }
}

const healthServer = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (handleStoreRoutes(req, res, url, store)) return;
  if (handleAdminRoutes(req, res, url, { earnings, adminToken })) return;
  if (handleApiRoutes(req, res, url, { accounts })) return;
  if (handleStatic(req, res, url)) return;

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        game: GAME_NAME,
        version: GAME_VERSION,
        protocol: PROTOCOL_VERSION,
        phase: gameServer.sim.phase,
        alive: gameServer.sim.aliveCount(),
        map: gameServer.sim.map.presetId,
        uptimeSec: Math.round(process.uptime()),
      }),
    );
    return;
  }
  if (url.pathname === '/api/version') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ game: GAME_NAME, version: GAME_VERSION, protocol: PROTOCOL_VERSION }));
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

healthServer.listen(HTTP_PORT, () => {
  console.log(`[nexo] game server ws://0.0.0.0:${PORT}`);
  console.log(`[nexo] health http://0.0.0.0:${HTTP_PORT}/health`);
  console.log(`[nexo] version ${GAME_VERSION} · mapa ${MAP_ID}`);
});

const shutdown = () => {
  clearInterval(loop);
  wss.close();
  healthServer.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
