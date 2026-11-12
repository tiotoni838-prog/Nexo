import { MAX_INPUT_RATE_PER_SEC } from './constants.js';
import type { ClientMsg } from './protocol.js';

export interface RateLimiterState {
  windowStart: number;
  count: number;
  strikes: number;
}

export const createRateLimiter = (): RateLimiterState => ({
  windowStart: 0,
  count: 0,
  strikes: 0,
});

export const allowMessage = (
  state: RateLimiterState,
  nowMs: number,
  maxPerSec: number = MAX_INPUT_RATE_PER_SEC,
): boolean => {
  if (nowMs - state.windowStart >= 1000) {
    state.windowStart = nowMs;
    state.count = 0;
  }
  state.count += 1;
  if (state.count > maxPerSec) {
    state.strikes += 1;
    return false;
  }
  return true;
};

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const validateClientMsg = (raw: unknown): ClientMsg | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const msg = raw as Record<string, unknown>;
  switch (msg.t) {
    case 'hello': {
      if (typeof msg.name !== 'string') return null;
      if (msg.name.length === 0 || msg.name.length > 16) return null;
      if (!isFiniteNumber(msg.protocol)) return null;
      return { t: 'hello', protocol: msg.protocol, name: msg.name };
    }
    case 'input': {
      if (!isFiniteNumber(msg.mx) || !isFiniteNumber(msg.my) || !isFiniteNumber(msg.aim)) return null;
      if (Math.abs(msg.mx) > 1 || Math.abs(msg.my) > 1) return null;
      if (Math.abs(msg.aim) > Math.PI * 4) return null;
      if (!isFiniteNumber(msg.seq)) return null;
      return {
        t: 'input',
        seq: msg.seq,
        mx: Math.max(-1, Math.min(1, msg.mx)),
        my: Math.max(-1, Math.min(1, msg.my)),
        aim: msg.aim,
        fire: msg.fire === true,
      };
    }
    case 'action': {
      const kinds = ['pickup', 'reload', 'use', 'swap', 'dropWeapon', 'throwGrenade'];
      if (typeof msg.kind !== 'string' || !kinds.includes(msg.kind)) return null;
      if (msg.kind === 'use' && msg.consumable !== 'botiquin' && msg.consumable !== 'escudo') return null;
      if (msg.kind === 'swap' && msg.slot !== 0 && msg.slot !== 1) return null;
      return msg as unknown as ClientMsg;
    }
    case 'drop': {
      if (!isFiniteNumber(msg.x) || !isFiniteNumber(msg.y)) return null;
      return { t: 'drop', x: msg.x, y: msg.y };
    }
    case 'ping': {
      if (!isFiniteNumber(msg.time)) return null;
      return { t: 'ping', time: msg.time };
    }
    default:
      return null;
  }
};

export const sanitizeName = (name: string): string =>
  name.replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16) || 'Jugador';
