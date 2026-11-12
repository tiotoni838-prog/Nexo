import { PROTOCOL_VERSION, MAX_PLAYERS, SNAPSHOT_HZ, TICK_MS } from '../shared/constants.js';
import { MatchSim, type SimPlayer } from '../shared/sim.js';
import { updateBot, type BotBrain } from '../shared/bots.js';
import {
  createRateLimiter,
  allowMessage,
  validateClientMsg,
  sanitizeName,
} from '../shared/validation.js';
import { AntiCheatMonitor } from '../shared/antiCheat.js';
import type { MapPresetId } from '../shared/map.js';
import type { GameModeId } from '../shared/gameModes.js';
import { WORLD_RADIUS } from '../shared/constants.js';
import { itemLabelEs } from '../shared/loot.js';
import type {
  ClientMsg,
  ServerMsg,
  SnapshotMsg,
  NetPlayer,
  NetItem,
} from '../shared/protocol.js';

export interface Connection {
  readonly id: number;
  send(msg: ServerMsg): void;
  close(): void;
}

export interface GameServerOptions {
  seed?: number;
  botCount?: number;
  mode?: 'solo-bots' | 'online';
  minPlayersToStart?: number;
  autoStartLobbyMs?: number;
  mapId?: MapPresetId;
  modeId?: GameModeId;
  onTick?: (sim: MatchSim) => void;
}

interface ClientState {
  connection: Connection;
  playerId: number;
  name: string;
  rateLimiter: ReturnType<typeof createRateLimiter>;
  lastInputSeq: number;
  joined: boolean;
}

const toNetPlayer = (p: SimPlayer, nowMs = 0): NetPlayer => {
  const weapon = p.inventory.weapons[p.inventory.activeWeapon];
  return {
    id: p.id,
    name: p.name,
    bot: p.bot,
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
    aim: Math.round(p.aim * 100) / 100,
    hp: Math.round(p.hp),
    shield: Math.round(p.shield),
    alive: p.alive,
    kills: p.kills,
    weaponId: weapon?.weaponId ?? null,
    rarity: weapon?.rarity ?? null,
    firing: p.firing,
    reloading: p.reloadEndMs > nowMs,
    landing: p.landing,
    characterId: p.characterId,
    prone: p.prone,
    sliding: p.sliding,
    abilityActive: p.abilityEndsAtMs > nowMs,
  };
};

const toNetItems = (sim: MatchSim): NetItem[] =>
  sim.items.map((i) => ({
    id: i.id,
    x: Math.round(i.pos.x),
    y: Math.round(i.pos.y),
    kind: i.kind,
    weaponId: i.weaponId,
    consumableId: i.consumableId,
    rarity: i.rarity,
    amount: i.amount,
  }));

export class GameServer {
  readonly sim: MatchSim;
  private clients = new Map<number, ClientState>();
  private botBrains = new Map<number, BotBrain>();
  private accumulatorMs = 0;
  private snapshotAccumulatorMs = 0;
  private lobbyTimerMs: number;
  private started = false;
  private resultsSent = false;
  private readonly minPlayersToStart: number;
  private readonly autoStartLobbyMs: number;
  private readonly mode: 'solo-bots' | 'online';
  private readonly onTick?: (sim: MatchSim) => void;

  constructor(options: GameServerOptions = {}) {
    const seed = options.seed ?? (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this.mode = options.mode ?? 'online';
    this.minPlayersToStart = options.minPlayersToStart ?? 1;
    this.autoStartLobbyMs = options.autoStartLobbyMs ?? 5000;
    this.lobbyTimerMs = this.autoStartLobbyMs;
    this.sim = new MatchSim({
      seed,
      botCount: options.botCount ?? 0,
      dropPhaseMs: 8000,
      mapId: options.mapId,
      modeId: options.modeId,
    });
    this.antiCheat = new AntiCheatMonitor();
  }

  readonly antiCheat: AntiCheatMonitor;

  addConnection(connection: Connection): void {
    if (this.clients.size >= MAX_PLAYERS) {
      connection.send({ t: 'error', code: 'server-full', msg: 'Server is full' });
      connection.close();
      return;
    }
    const client: ClientState = {
      connection,
      playerId: -1,
      name: 'Jugador',
      rateLimiter: createRateLimiter(),
      lastInputSeq: 0,
      joined: false,
    };
    this.clients.set(connection.id, client);
  }

  removeConnection(connectionId: number): void {
    const client = this.clients.get(connectionId);
    this.clients.delete(connectionId);
    if (!client || client.playerId < 0) return;
    const player = this.sim.players.find((p) => p.id === client.playerId);
    if (player && player.alive && this.sim.phase !== 'over') {
      this.sim.players = this.sim.players.filter((p) => p.id !== client.playerId);
    }
  }

  handleRawMessage(connectionId: number, raw: unknown, nowMs = Date.now()): void {
    const client = this.clients.get(connectionId);
    if (!client) return;

    if (!allowMessage(client.rateLimiter, nowMs)) {
      if (client.rateLimiter.strikes > 20) {
        client.connection.send({ t: 'error', code: 'rate-limit', msg: 'Too many messages' });
        client.connection.close();
      }
      return;
    }

    const msg = validateClientMsg(raw);
    if (!msg) {
      client.connection.send({ t: 'error', code: 'bad-message', msg: 'Invalid message' });
      return;
    }

    this.handleMessage(client, msg);
  }

  private handleMessage(client: ClientState, msg: ClientMsg): void {
    switch (msg.t) {
      case 'hello': {
        if (client.joined) return;
        if (msg.protocol !== PROTOCOL_VERSION) {
          client.connection.send({
            t: 'error',
            code: 'version-mismatch',
            msg: `Server protocol ${PROTOCOL_VERSION}, client ${msg.protocol}`,
          });
          client.connection.close();
          return;
        }
        client.name = sanitizeName(msg.name);
        const player = this.sim.addPlayer(client.name, false, msg.characterId);
        client.playerId = player.id;
        client.joined = true;
        client.connection.send({
          t: 'welcome',
          protocol: PROTOCOL_VERSION,
          yourId: player.id,
          mapSeed: this.sim.seed,
          map: this.sim.map,
          mode: this.mode,
          tickHz: 1000 / TICK_MS,
        });
        client.connection.send({ t: 'phase', phase: this.sim.phase });
        return;
      }
      case 'input': {
        if (client.playerId < 0) return;
        client.lastInputSeq = msg.seq;
        this.sim.setInput(client.playerId, {
          mx: msg.mx,
          my: msg.my,
          aim: msg.aim,
          fire: msg.fire,
          seq: msg.seq,
          slide: msg.slide === true,
          prone: msg.prone === true,
        });
        return;
      }
      case 'action': {
        if (client.playerId < 0) return;
        const pid = client.playerId;
        switch (msg.kind) {
          case 'pickup':
            this.sim.pickup(pid);
            break;
          case 'reload':
            this.sim.reload(pid);
            break;
          case 'use':
            if (msg.consumable) this.sim.useConsumable(pid, msg.consumable);
            break;
          case 'swap':
            if (typeof msg.slot === 'number') this.sim.swapWeapon(pid, msg.slot);
            break;
          case 'dropWeapon':
            this.sim.dropWeapon(pid);
            break;
          case 'throwGrenade':
            this.sim.throwGrenade(pid);
            break;
          case 'ability':
            this.sim.useAbility(pid);
            break;
        }
        return;
      }
      case 'drop': {
        if (client.playerId < 0) return;
        this.sim.chooseDrop(client.playerId, msg.x, msg.y);
        return;
      }
      case 'ping': {
        client.connection.send({ t: 'pong', time: msg.time });
        return;
      }
    }
  }

  update(dtMs: number): void {
    if (!this.started) {
      const humans = [...this.clients.values()].filter((c) => c.joined).length;
      if (this.mode === 'solo-bots' && humans >= 1) {
        this.started = true;
        this.sim.startDrop();
        this.broadcast({ t: 'phase', phase: 'drop', dropEndsAtMs: this.sim.dropEndsAtMs });
      } else if (humans >= this.minPlayersToStart) {
        this.lobbyTimerMs -= dtMs;
        if (this.lobbyTimerMs <= 0) {
          this.started = true;
          this.sim.startDrop();
          this.broadcast({ t: 'phase', phase: 'drop', dropEndsAtMs: this.sim.dropEndsAtMs });
        }
      }
    }

    this.accumulatorMs += dtMs;
    let steps = 0;
    while (this.accumulatorMs >= TICK_MS && steps < 10) {
      this.accumulatorMs -= TICK_MS;
      steps += 1;
      this.simulateTick();
      this.runAntiCheat();
    }

    this.snapshotAccumulatorMs += dtMs;
    if (this.snapshotAccumulatorMs >= 1000 / SNAPSHOT_HZ) {
      this.snapshotAccumulatorMs = 0;
      this.broadcastSnapshots();
    }

    if (this.sim.phase === 'over' && !this.resultsSent) {
      this.resultsSent = true;
      this.broadcastResults();
    }

    this.onTick?.(this.sim);
  }

  private runAntiCheat(): void {
    const nowMs = this.sim.timeMs;
    for (const client of this.clients.values()) {
      if (!client.joined || client.playerId < 0) continue;
      const player = this.sim.players.find((p) => p.id === client.playerId);
      if (!player || !player.alive) continue;
      const verdict = this.antiCheat.validateMovement(
        player.id,
        player.x,
        player.y,
        nowMs,
        WORLD_RADIUS,
      );
      if (!verdict.ok && this.antiCheat.shouldKick(player.id)) {
        client.connection.send({
          t: 'error',
          code: 'anti-cheat-kick',
          msg: `Movimiento ilegal detectado (${verdict.reason}). Has sido expulsado.`,
        });
        this.sim.players = this.sim.players.filter((p) => p.id !== player.id);
        client.joined = false;
        client.playerId = -1;
        this.antiCheat.forget(player.id);
        client.connection.close();
      }
    }
    this.antiCheat.decay(nowMs);
  }

  private simulateTick(): void {
    for (const player of this.sim.players) {
      if (player.bot) {
        let brain = this.botBrains.get(player.id);
        if (!brain) {
          brain = {
            wanderTarget: null,
            nextDecisionMs: 0,
            strafeDir: Math.random() < 0.5 ? -1 : 1,
            reactionDelayMs: 120 + Math.random() * 260,
            grenadeReadyMs: 0,
            abilityReadyMs: 0,
          };
          this.botBrains.set(player.id, brain);
        }
        updateBot(this.sim, player, brain, TICK_MS);
      }
    }
    this.sim.tick(TICK_MS);
  }

  private broadcast(msg: ServerMsg): void {
    for (const client of this.clients.values()) {
      if (client.joined) client.connection.send(msg);
    }
  }

  private broadcastSnapshots(): void {
    const base: Omit<SnapshotMsg, 'you'> = {
      t: 'snapshot',
      tick: this.sim.tickCount,
      timeMs: Math.round(this.sim.timeMs),
      phase: this.sim.phase,
      zoneTimerMs: Math.round(this.sim.zone.timerMs),
      zoneMode: this.sim.zone.mode,
      zonePhase: this.sim.zone.phase,
      zone: {
        cx: Math.round(this.sim.zone.cx),
        cy: Math.round(this.sim.zone.cy),
        r: Math.round(this.sim.zone.radius),
        tcx: Math.round(this.sim.zone.targetCx),
        tcy: Math.round(this.sim.zone.targetCy),
        tr: Math.round(this.sim.zone.targetRadius),
      },
      alive: this.sim.aliveCount(),
      players: this.sim.players.map((p) => toNetPlayer(p, this.sim.timeMs)),
      bullets: this.sim.bullets.map((b) => ({
        id: b.id,
        x: Math.round(b.x),
        y: Math.round(b.y),
        vx: Math.round(b.vx),
        vy: Math.round(b.vy),
        ownerId: b.ownerId,
      })),
      grenades: this.sim.grenades.map((g) => ({
        id: g.id,
        x: Math.round(g.x),
        y: Math.round(g.y),
      })),
      items: toNetItems(this.sim),
      walls: this.sim.walls.map((w) => ({
        id: w.id,
        x: Math.round(w.x),
        y: Math.round(w.y),
        w: Math.round(w.w),
        h: Math.round(w.h),
        hp: Math.round(w.hp),
      })),
    };

    for (const client of this.clients.values()) {
      if (!client.joined) continue;
      const p = this.sim.players.find((pl) => pl.id === client.playerId);
      const you = p
        ? {
            hp: Math.round(p.hp),
            shield: Math.round(p.shield),
            ammo: p.inventory.ammo,
            mag: p.inventory.weapons[p.inventory.activeWeapon]?.ammoInMag ?? 0,
            botiquines: p.inventory.botiquines,
            escudos: p.inventory.escudos,
            grenades: p.inventory.grenades,
            activeSlot: p.inventory.activeWeapon,
            weapons: p.inventory.weapons,
            reloading: p.reloadEndMs > this.sim.timeMs,
            characterId: p.characterId,
            abilityCooldownMs:
              p.abilityReadyMs > this.sim.timeMs
                ? Math.round(p.abilityReadyMs - this.sim.timeMs)
                : 0,
            prone: p.prone,
          }
        : null;
      client.connection.send({ ...base, you } as SnapshotMsg);
    }
  }

  private broadcastResults(): void {
    const winner = this.sim.players.find((p) => p.id === this.sim.winnerId);
    for (const client of this.clients.values()) {
      if (!client.joined) continue;
      const p = this.sim.players.find((pl) => pl.id === client.playerId);
      client.connection.send({
        t: 'result',
        placement: p ? this.sim.placementOf(p.id) : 0,
        totalPlayers: this.sim.players.length,
        kills: p?.kills ?? 0,
        winnerId: this.sim.winnerId,
        winnerName: winner?.name ?? '—',
      });
    }
  }

  broadcastEventTo(clientId: number, msg: ServerMsg): void {
    const client = this.clients.get(clientId);
    if (client?.joined) client.connection.send(msg);
  }

  itemLabelFor(item: NetItem, lang: 'es' | 'en'): string {
    void lang;
    return itemLabelEs({
      id: item.id,
      pos: { x: item.x, y: item.y },
      kind: item.kind as never,
      weaponId: item.weaponId,
      consumableId: item.consumableId,
      rarity: item.rarity,
      amount: item.amount,
    });
  }
}
