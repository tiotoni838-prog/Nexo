import type { WeaponId } from './weapons.js';

/**
 * Anti-hacker server-side (autoritativo). El cliente solo envía intenciones;
 * el servidor valida todo lo que afecta la simulación:
 *
 *  - Movimiento: distancia máxima por tick según velocidad legal máxima
 *    (sprint 1.55x y slide 1.6x ya incluidos en la tolerancia). Un salto mayor
 *    que la tolerancia es un teletransporte ilegal (speedhack / teleport hack).
 *  - Posición fuera del mundo: imposible legalmente.
 *  - Cadencia de disparo: ya la aplica el servidor (sim.fireWeapon usa
 *    nextFireAtMs); el cliente no puede disparar más rápido.
 *  - Rate limit de mensajes + strikes → expulsión (gameServer.ts).
 *  - Detección estadística: acumula strikes por repetidas violaciones y expulsa.
 */
export interface MovementSample {
  x: number;
  y: number;
  timeMs: number;
}

export interface AntiCheatConfig {
  maxSpeedPerTick: number;
  teleportThresholdPerTick: number;
  strikeLimit: number;
  strikeDecayMs: number;
}

export const DEFAULT_ANTI_CHEAT_CONFIG: AntiCheatConfig = {
  maxSpeedPerTick: 12,
  teleportThresholdPerTick: 90,
  strikeLimit: 10,
  strikeDecayMs: 10_000,
};

export interface AntiCheatVerdict {
  ok: boolean;
  strikes: number;
  reason: 'ok' | 'speed' | 'teleport' | 'out-of-world';
}

export class AntiCheatMonitor {
  private last = new Map<number, MovementSample>();
  private strikes = new Map<number, { count: number; lastAtMs: number }>();
  private readonly config: AntiCheatConfig;

  constructor(config: Partial<AntiCheatConfig> = {}) {
    this.config = { ...DEFAULT_ANTI_CHEAT_CONFIG, ...config };
  }

  validateMovement(
    playerId: number,
    x: number,
    y: number,
    nowMs: number,
    worldRadius: number,
  ): AntiCheatVerdict {
    const prev = this.last.get(playerId);
    this.last.set(playerId, { x, y, timeMs: nowMs });

    if (Math.hypot(x, y) > worldRadius + 50) {
      return this.penalize(playerId, nowMs, 'out-of-world');
    }
    if (!prev) return this.okVerdict();

    const dist = Math.hypot(x - prev.x, y - prev.y);
    if (dist > this.config.teleportThresholdPerTick) {
      return this.penalize(playerId, nowMs, 'teleport');
    }
    if (dist > this.config.maxSpeedPerTick) {
      return this.penalize(playerId, nowMs, 'speed');
    }
    return this.okVerdict();
  }

  validateFireInterval(weaponIntervalMs: number, lastShotMs: number, nowMs: number): boolean {
    if (lastShotMs < 0) return true;
    return nowMs - lastShotMs >= weaponIntervalMs - 10;
  }

  strikeCount(playerId: number): number {
    return this.strikes.get(playerId)?.count ?? 0;
  }

  shouldKick(playerId: number): boolean {
    return this.strikeCount(playerId) >= this.config.strikeLimit;
  }

  decay(nowMs: number): void {
    for (const [id, s] of this.strikes) {
      if (nowMs - s.lastAtMs > this.config.strikeDecayMs) this.strikes.delete(id);
    }
  }

  forget(playerId: number): void {
    this.last.delete(playerId);
    this.strikes.delete(playerId);
  }

  private okVerdict(): AntiCheatVerdict {
    return { ok: true, strikes: 0, reason: 'ok' };
  }

  private penalize(playerId: number, nowMs: number, reason: AntiCheatVerdict['reason']): AntiCheatVerdict {
    const entry = this.strikes.get(playerId) ?? { count: 0, lastAtMs: nowMs };
    entry.count += 1;
    entry.lastAtMs = nowMs;
    this.strikes.set(playerId, entry);
    return { ok: false, strikes: entry.count, reason };
  }
}
