import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GameServer, type Connection } from '../src/server/gameServer.js';
import type { ServerMsg } from '../src/shared/protocol.js';
import { PROTOCOL_VERSION } from '../src/shared/constants.js';

class FakeConnection implements Connection {
  readonly id: number;
  sent: ServerMsg[] = [];
  closed = false;
  constructor(id: number) {
    this.id = id;
  }
  send(msg: ServerMsg): void {
    this.sent.push(msg);
  }
  close(): void {
    this.closed = true;
  }
  last(t: ServerMsg['t']): ServerMsg | undefined {
    return [...this.sent].reverse().find((m) => m.t === t);
  }
  snapshots(): Extract<ServerMsg, { t: 'snapshot' }>[] {
    return this.sent.filter((m): m is Extract<ServerMsg, { t: 'snapshot' }> => m.t === 'snapshot');
  }
}

const makeServer = () =>
  new GameServer({ seed: 42, botCount: 3, mode: 'solo-bots', autoStartLobbyMs: 500 });

describe('GameServer', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  it('rechaza versiones de protocolo incompatibles', () => {
    const server = makeServer();
    const conn = new FakeConnection(1);
    server.addConnection(conn);
    server.handleRawMessage(1, { t: 'hello', protocol: PROTOCOL_VERSION + 99, name: 'x' });
    expect(conn.last('error')?.code ?? (conn.last('error') as { code: string } | undefined)?.code).toBe('version-mismatch');
    expect(conn.closed).toBe(true);
  });

  it('da bienvenida, arranca la partida y envía snapshots', () => {
    const server = makeServer();
    const conn = new FakeConnection(1);
    server.addConnection(conn);
    server.handleRawMessage(1, { t: 'hello', protocol: PROTOCOL_VERSION, name: 'jugador' });

    const welcome = conn.last('welcome');
    expect(welcome).toBeDefined();
    expect(welcome && 'yourId' in welcome ? welcome.yourId : -1).toBeGreaterThan(0);

    server.update(600);
    const phase = conn.last('phase');
    expect(phase && 'phase' in phase ? phase.phase : '').toBe('drop');

    for (let i = 0; i < 60; i++) server.update(33);
    expect(conn.snapshots().length).toBeGreaterThan(3);
    const snap = conn.snapshots().at(-1)!;
    expect(snap.players.length).toBe(4);
    expect(snap.players.some((p) => p.bot)).toBe(true);
  });

  it('valida mensajes inválidos sin romperse', () => {
    const server = makeServer();
    const conn = new FakeConnection(1);
    server.addConnection(conn);
    server.handleRawMessage(1, null);
    server.handleRawMessage(1, { t: 'input', mx: 'injection', my: 0, aim: 0, fire: true, seq: 1 });
    server.handleRawMessage(1, { t: 'action', kind: 'hack-server' });
    expect(conn.last('error')?.t).toBe('error');
  });

  it('limita el rate de mensajes y expulsa abusadores', () => {
    const server = makeServer();
    const conn = new FakeConnection(1);
    server.addConnection(conn);
    server.handleRawMessage(1, { t: 'hello', protocol: PROTOCOL_VERSION, name: 'spam' });
    for (let i = 0; i < 3000; i++) {
      server.handleRawMessage(1, { t: 'input', seq: i, mx: 1, my: 0, aim: 0, fire: false }, 0);
    }
    expect(conn.closed).toBe(true);
  });

  it('el cliente nunca decide resultados: input fuera de rango se satura', () => {
    const server = makeServer();
    const conn = new FakeConnection(1);
    server.addConnection(conn);
    server.handleRawMessage(1, { t: 'hello', protocol: PROTOCOL_VERSION, name: 'p' });
    server.update(600);
    server.update(33);
    const yourId = (conn.last('welcome') as { yourId: number }).yourId;
    server.handleRawMessage(1, { t: 'input', seq: 1, mx: 9999, my: -9999, aim: 0, fire: false });
    for (let i = 0; i < 30; i++) server.update(33);
    const snap = conn.snapshots().at(-1)!;
    const me = snap.players.find((p) => p.id === yourId)!;
    expect(Math.abs(me.x)).toBeLessThanOrEqual(1201);
    expect(Math.abs(me.y)).toBeLessThanOrEqual(1201);
  });

  it('una partida con humano y bots llega a un resultado autoritativo', () => {
    const server = makeServer();
    const conn = new FakeConnection(1);
    server.addConnection(conn);
    server.handleRawMessage(1, { t: 'hello', protocol: PROTOCOL_VERSION, name: 'campeón' });
    server.update(600);
    for (let i = 0; i < 20000 && server.sim.phase !== 'over'; i++) server.update(33);
    expect(server.sim.phase).toBe('over');
    const result = conn.last('result');
    expect(result).toBeDefined();
    expect(result && 'totalPlayers' in result ? result.totalPlayers : 0).toBe(4);
  });
});
