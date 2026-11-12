import { describe, expect, it } from 'vitest';
import {
  allowMessage,
  createRateLimiter,
  sanitizeName,
  validateClientMsg,
} from '../src/shared/validation.js';

describe('validación de mensajes', () => {
  it('sanea nombres: longitud, caracteres y vacío', () => {
    expect(sanitizeName('  Jugador<>  ')).toBe('Jugador');
    expect(sanitizeName('x'.repeat(100)).length).toBeLessThanOrEqual(16);
    expect(sanitizeName('')).toBe('Jugador');
    expect(sanitizeName('Ñandú 07')).toBe('Ñandú 07');
  });

  it('rechaza inputs malformados y satura valores fuera de rango', () => {
    expect(validateClientMsg(null)).toBeNull();
    expect(validateClientMsg({ t: 'input', mx: 'x', my: 0, aim: 0, seq: 1 })).toBeNull();
    expect(validateClientMsg({ t: 'input', mx: 5, my: 0, aim: 0, seq: 1 })).toBeNull();
    const ok = validateClientMsg({ t: 'input', mx: 0.7, my: 0.7, aim: 3, fire: true, seq: 2 });
    expect(ok).toEqual({ t: 'input', seq: 2, mx: 0.7, my: 0.7, aim: 3, fire: true, slide: false, prone: false });
  });

  it('rechaza acciones desconocidas y consumibles inventados', () => {
    expect(validateClientMsg({ t: 'action', kind: 'teleport' })).toBeNull();
    expect(validateClientMsg({ t: 'action', kind: 'use', consumable: 'dinero-infinito' })).toBeNull();
    expect(validateClientMsg({ t: 'action', kind: 'swap', slot: 9 })).toBeNull();
    expect(validateClientMsg({ t: 'action', kind: 'use', consumable: 'botiquin' })).not.toBeNull();
  });

  it('rate limiter: permite tráfico normal y bloquea ráfagas', () => {
    const limiter = createRateLimiter();
    let allowed = 0;
    for (let i = 0; i < 100; i++) {
      if (allowMessage(limiter, 0)) allowed += 1;
    }
    expect(allowed).toBeLessThanOrEqual(90);
    expect(limiter.strikes).toBeGreaterThan(0);
    const fresh = createRateLimiter();
    expect(allowMessage(fresh, 0)).toBe(true);
    expect(allowMessage(fresh, 1000)).toBe(true);
  });
});
