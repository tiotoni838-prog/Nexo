import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import { GameServer, type Connection } from './gameServer.js';
import { TICK_MS, PROTOCOL_VERSION } from '../shared/constants.js';
import { StoreService, mountStoreRoutes } from '../paypal/storeRoutes.js';

const PORT = Number(process.env.NEXO_PORT ?? 7777);
const HTTP_PORT = Number(process.env.NEXO_HTTP_PORT ?? 8080);

const gameServer = new GameServer({
  mode: 'online',
  botCount: Number(process.env.NEXO_BOTS ?? 7),
  minPlayersToStart: 1,
  autoStartLobbyMs: 4000,
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
}

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        protocol: PROTOCOL_VERSION,
        phase: gameServer.sim.phase,
        alive: gameServer.sim.aliveCount(),
        uptimeSec: Math.round(process.uptime()),
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

mountStoreRoutes(healthServer, store);

healthServer.listen(HTTP_PORT, () => {
  console.log(`[nexo] game server ws://0.0.0.0:${PORT}`);
  console.log(`[nexo] health http://0.0.0.0:${HTTP_PORT}/health`);
});

const shutdown = () => {
  clearInterval(loop);
  wss.close();
  healthServer.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
