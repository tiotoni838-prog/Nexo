import { describe, expect, it } from 'vitest';
import { Rng } from '../src/shared/rng.js';
import {
  BATTLE_PASS,
  PASS_TIERS,
  passXpForMatch,
  passLevelFromXp,
  passTierReward,
  totalPassXpToComplete,
} from '../src/shared/battlePass.js';
import {
  ROULETTE_POOL,
  ROULETTE_SPIN_COST_DALOS,
  rouletteTotalWeight,
  rouletteChance,
  spinRoulette,
  canFreeSpin,
  nextFreeSpinMs,
  FREE_SPIN_COOLDOWN_MS,
} from '../src/shared/roulette.js';
import {
  emptyLocker,
  ownItem,
  isOwned,
  equipItem,
  unequipSlot,
  masteryLevel,
  masteryProgress,
  masteryTitle,
} from '../src/shared/locker.js';
import { DALO_PACKS, daloPackAmount, STORE_CATALOG } from '../src/paypal/store.js';

describe('pase de batalla', () => {
  it('tiene 30 niveles con recompensa gratis y premium en cada uno', () => {
    expect(PASS_TIERS).toHaveLength(30);
    for (const tier of PASS_TIERS) {
      expect(tier.free.kind).toBeTruthy();
      expect(tier.premium.kind).toBeTruthy();
    }
  });

  it('el último nivel premium da la skin legendaria de temporada', () => {
    const final = passTierReward(30, true);
    expect(final?.kind).toBe('skin');
    expect(final?.sku).toBe('dalo-skin-fenix');
  });

  it('la XP crece con kills y buena posición', () => {
    const base = passXpForMatch(0, 10, 10);
    const better = passXpForMatch(5, 1, 10);
    expect(better).toBeGreaterThan(base);
  });

  it('calcula nivel y progreso desde XP acumulada', () => {
    expect(passLevelFromXp(0).tier).toBe(1);
    expect(passLevelFromXp(499).tier).toBe(1);
    expect(passLevelFromXp(500).tier).toBe(2);
    expect(passLevelFromXp(1500).tier).toBe(4);
    const maxed = passLevelFromXp(totalPassXpToComplete() * 10);
    expect(maxed.tier).toBe(BATTLE_PASS.tierCount);
  });

  it('el premio de un nivel inexistente es null', () => {
    expect(passTierReward(0, false)).toBeNull();
    expect(passTierReward(31, false)).toBeNull();
  });
});

describe('ruleta', () => {
  it('el pool suma pesos positivos y las probabilidades son coherentes', () => {
    expect(rouletteTotalWeight()).toBeGreaterThan(0);
    for (const prize of ROULETTE_POOL) {
      expect(prize.weight).toBeGreaterThan(0);
      const chance = rouletteChance(prize.id);
      expect(chance).toBeGreaterThan(0);
      expect(chance).toBeLessThanOrEqual(1);
    }
  });

  it('el jackpot es el premio más raro y el 50 NX el más común', () => {
    expect(rouletteChance('jackpot-nx-1000')).toBeLessThan(rouletteChance('nx-400'));
    expect(rouletteChance('nx-50')).toBeGreaterThan(rouletteChance('nx-150'));
  });

  it('solo entrega premios del pool (determinista con semilla)', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 200; i++) {
      const prize = spinRoulette(rng);
      expect(ROULETTE_POOL.some((p) => p.id === prize.id)).toBe(true);
    }
  });

  it('giro gratis cada 24 h; los extra cuestan Dalos', () => {
    const now = 1_000_000;
    expect(canFreeSpin(now - FREE_SPIN_COOLDOWN_MS, now)).toBe(true);
    expect(canFreeSpin(now - 1000, now)).toBe(false);
    expect(nextFreeSpinMs(now - 1000, now)).toBe(FREE_SPIN_COOLDOWN_MS - 1000);
    expect(ROULETTE_SPIN_COST_DALOS).toBeGreaterThan(0);
  });
});

describe('armario y evolutivas', () => {
  it('equipar exige poseer el artículo', () => {
    let locker = emptyLocker();
    const before = equipItem(locker, 'skin', 'skin-aurora-vanguard');
    expect(before.error).toBe('not-owned');
    locker = ownItem(locker, 'skin-aurora-vanguard');
    expect(isOwned(locker, 'skin-aurora-vanguard')).toBe(true);
    const after = equipItem(locker, 'skin', 'skin-aurora-vanguard');
    expect(after.error).toBeUndefined();
    expect(after.locker.equipped.skin).toBe('skin-aurora-vanguard');
  });

  it('poseer dos veces no duplica y desequipar limpia el hueco', () => {
    let locker = emptyLocker();
    locker = ownItem(locker, 'trail-solar-flare');
    locker = ownItem(locker, 'trail-solar-flare');
    expect(locker.owned).toHaveLength(1);
    locker = equipItem(locker, 'trail', 'trail-solar-flare').locker;
    locker = unequipSlot(locker, 'trail');
    expect(locker.equipped.trail).toBeUndefined();
  });

  it('la maestría sube por umbrales y tiene título por nivel', () => {
    expect(masteryLevel(0)).toBe(0);
    expect(masteryLevel(499)).toBe(0);
    expect(masteryLevel(500)).toBe(1);
    expect(masteryLevel(11000)).toBe(6);
    expect(masteryLevel(99999)).toBe(6);
    const p = masteryProgress(1000);
    expect(p.level).toBe(1);
    expect(p.progress).toBeGreaterThan(0);
    expect(p.xpToNext).toBe(500);
    expect(masteryProgress(99999).xpToNext).toBeNull();
    expect(masteryTitle(6)).toBe('Leyenda');
    expect(masteryTitle(0, 'en')).toBe('Rookie');
  });
});

describe('economía de Dalos', () => {
  it('hay 4 paquetes de Dalos con precio USD y monto definido', () => {
    expect(DALO_PACKS).toHaveLength(4);
    for (const pack of DALO_PACKS) {
      expect(pack.kind).toBe('dalo-pack');
      expect(pack.priceUsd).toMatch(/^\d+\.\d{2}$/);
      expect(daloPackAmount(pack.sku)).toBeGreaterThan(0);
    }
    expect(daloPackAmount('dalo-550')).toBe(600);
    expect(daloPackAmount('inexistente')).toBe(0);
  });

  it('la tienda tiene artículos de las tres monedas, todos cosméticos', () => {
    expect(STORE_CATALOG.some((i) => i.currency === 'USD')).toBe(true);
    expect(STORE_CATALOG.some((i) => i.currency === 'NX')).toBe(true);
    expect(STORE_CATALOG.some((i) => i.currency === 'DALO')).toBe(true);
    for (const item of STORE_CATALOG) {
      expect([
        'skin',
        'emote',
        'trail',
        'banner',
        'spray',
        'paracaidas',
        'marco',
        'insignia',
        'mascota',
        'dalo-pack',
      ]).toContain(item.kind);
    }
  });
});
