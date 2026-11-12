import { PROTOCOL_VERSION, TICK_MS } from '../shared/constants.js';
import type { ClientMsg, ServerMsg, SnapshotMsg, WelcomeMsg } from '../shared/protocol.js';

export interface NetHandlers {
  onWelcome: (msg: WelcomeMsg) => void;
  onSnapshot: (msg: SnapshotMsg) => void;
  onServerMsg: (msg: ServerMsg) => void;
  onDisconnect: () => void;
}

export interface Transport {
  send(msg: ClientMsg): void;
  close(): void;
}

export class WsTransport implements Transport {
  private ws: WebSocket | null = null;

  connect(url: string, handlers: NetHandlers): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('connection-failed'));
      ws.onclose = () => handlers.onDisconnect();
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as ServerMsg;
          if (msg.t === 'welcome') handlers.onWelcome(msg);
          else if (msg.t === 'snapshot') handlers.onSnapshot(msg);
          else handlers.onServerMsg(msg);
        } catch {
          // ignore malformed frames
        }
      };
    });
  }

  send(msg: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}

export class ClientNet {
  readonly transport: Transport;
  private inputSeq = 0;
  private latestServerTick = 0;
  private lastServerTimeMs = 0;
  private lastLocalTimeMs = 0;

  constructor(transport: Transport) {
    this.transport = transport;
  }

  sendHello(name: string, lang: 'es' | 'en'): void {
    this.transport.send({ t: 'hello', protocol: PROTOCOL_VERSION, name, lang });
  }

  sendInput(mx: number, my: number, aim: number, fire: boolean): void {
    this.inputSeq += 1;
    this.transport.send({ t: 'input', seq: this.inputSeq, mx, my, aim, fire });
  }

  sendAction(action: Extract<ClientMsg, { t: 'action' }>): void {
    this.transport.send(action);
  }

  sendDropChoice(x: number, y: number): void {
    this.transport.send({ t: 'drop', x, y });
  }

  onSnapshot(msg: SnapshotMsg): void {
    this.latestServerTick = msg.tick;
    this.lastServerTimeMs = msg.timeMs;
    this.lastLocalTimeMs = performance.now();
  }

  estimatedServerTimeMs(): number {
    return this.lastServerTimeMs + (performance.now() - this.lastLocalTimeMs);
  }

  get tick(): number {
    return this.latestServerTick;
  }

  get tickRate(): number {
    return 1000 / TICK_MS;
  }
}
