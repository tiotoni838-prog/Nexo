import { describe, expect, it } from 'vitest';
import { AntiCheatMonitor, DEFAULT_ANTI_CHEAT_CONFIG } from '../src/shared/antiCheat.js';

describe('sistema anti-hacker', () => {
  it('acepta movimiento legal dentro del límite de velocidad por tick', () => {
    const ac = new AntiCheatMonitor();
    const v1 = ac.validateMovement(1, 0, 0, 0, 1200);
    expect(v1.ok).toBe(true);
    const v2 = ac.validateMovement(1, 10, 0, 33, 1200);
    expect(v2.ok).toBe(true);
    expect(v2.reason).toBe('ok');
  });

  it('detecta speedhack (demasiada distancia por tick)', () => {
    const ac = new AntiCheatMonitor();
    ac.validateMovement(1, 0, 0, 0, 1200);
    const v = ac.validateMovement(1, 40, 0, 33, 1200);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('speed');
    expect(v.strikes).toBe(1);
  });

  it('detecta teletransporte ilegal', () => {
    const ac = new AntiCheatMonitor();
    ac.validateMovement(1, 0, 0, 0, 1200);
    const v = ac.validateMovement(1, 500, 500, 33, 1200);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('teleport');
  });

  it('detecta posición fuera del mundo', () => {
    const ac = new AntiCheatMonitor();
    const v = ac.validateMovement(1, 5000, 0, 0, 1200);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('out-of-world');
  });

  it('expulsa tras acumular el límite de strikes', () => {
    const ac = new AntiCheatMonitor();
    ac.validateMovement(1, 0, 0, 0, 1200);
    let i = 0;
    while (!ac.shouldKick(1)) {
      i += 1;
      ac.validateMovement(1, 100, 0, i * 100, 1200);
      ac.validateMovement(1, 0, 0, i * 100 + 1, 1200);
    }
    expect(ac.strikeCount(1)).toBeGreaterThanOrEqual(DEFAULT_ANTI_CHEAT_CONFIG.strikeLimit);
  });

  it('los strikes decaen tras el periodo de gracia', () => {
    const ac = new AntiCheatMonitor({ strikeDecayMs: 1000 });
    ac.validateMovement(1, 0, 0, 0, 1200);
    ac.validateMovement(1, 100, 0, 10, 1200);
    expect(ac.strikeCount(1)).toBe(1);
    ac.decay(2000);
    expect(ac.strikeCount(1)).toBe(0);
  });

  it('valida la cadencia de disparo contra el intervalo del arma', () => {
    const ac = new AntiCheatMonitor();
    expect(ac.validateFireInterval(150, -1, 0)).toBe(true);
    expect(ac.validateFireInterval(150, 1000, 1130)).toBe(false);
    expect(ac.validateFireInterval(150, 1000, 1145)).toBe(true);
  });

  it('olvida a un jugador al desconectarse', () => {
    const ac = new AntiCheatMonitor();
    ac.validateMovement(1, 0, 0, 0, 1200);
    ac.forget(1);
    const v = ac.validateMovement(1, 3, 0, 33, 1200);
    expect(v.ok).toBe(true);
  });
});
