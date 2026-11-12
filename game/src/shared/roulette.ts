import { Rng } from './rng.js';

export interface RngLike {
  next(): number;
}

/**
 * Ruleta Nexo: 1 giro GRATIS cada 24 h + giros extra con Dalos.
 * Pool 100% cosmético (skins, estelas, gestos, banners y NX).
 * Probabilidades visibles y honestas: sin loot boxes pagadas opacas —
 * los premios en Dalos compran cosméticos concretos de la tienda.
 */

export interface RoulettePrize {
  id: string;
  kind: 'nx' | 'skin' | 'emote' | 'trail' | 'banner';
  sku?: string;
  amount?: number;
  weight: number;
  rarity: 'raro' | 'epico' | 'legendario';
  labelEs: string;
  labelEn: string;
}

export const ROULETTE_SPIN_COST_DALOS = 40;
export const FREE_SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const ROULETTE_POOL: RoulettePrize[] = [
  { id: 'nx-50', kind: 'nx', amount: 50, weight: 40, rarity: 'raro', labelEs: '50 NX', labelEn: '50 NX' },
  { id: 'nx-150', kind: 'nx', amount: 150, weight: 25, rarity: 'raro', labelEs: '150 NX', labelEn: '150 NX' },
  { id: 'nx-400', kind: 'nx', amount: 400, weight: 12, rarity: 'epico', labelEs: '400 NX', labelEn: '400 NX' },
  { id: 'banner-victoria', kind: 'banner', sku: 'nx-banner-victoria', weight: 10, rarity: 'epico', labelEs: 'Banner: Victoria Nexo', labelEn: 'Banner: Nexo Victory' },
  { id: 'trail-chispas', kind: 'trail', sku: 'nx-trail-chispas', weight: 8, rarity: 'epico', labelEs: 'Estela: Chispas de Combate', labelEn: 'Trail: Combat Sparks' },
  { id: 'skin-centinela', kind: 'skin', sku: 'nx-skin-centinela', weight: 4, rarity: 'epico', labelEs: 'Skin: Centinela de Acero', labelEn: 'Skin: Steel Sentinel' },
  { id: 'emote-baile', kind: 'emote', sku: 'nx-emote-baile', weight: 0.9, rarity: 'legendario', labelEs: 'Gesto: Baile del Nexo', labelEn: 'Emote: Nexo Dance' },
  { id: 'jackpot-nx-1000', kind: 'nx', amount: 1000, weight: 0.1, rarity: 'legendario', labelEs: '¡1.000 NX!', labelEn: '1,000 NX!' },
];

export const rouletteTotalWeight = (): number =>
  ROULETTE_POOL.reduce((s, p) => s + p.weight, 0);

export const rouletteChance = (prizeId: string): number => {
  const prize = ROULETTE_POOL.find((p) => p.id === prizeId);
  if (!prize) return 0;
  return prize.weight / rouletteTotalWeight();
};

export const spinRoulette = (rng: RngLike = new Rng(Date.now() ^ (Math.random() * 0xffffffff))): RoulettePrize => {
  let roll = rng.next() * rouletteTotalWeight();
  for (const prize of ROULETTE_POOL) {
    roll -= prize.weight;
    if (roll <= 0) return prize;
  }
  return ROULETTE_POOL[0]!;
};

export const canFreeSpin = (lastFreeSpinMs: number, nowMs: number): boolean =>
  nowMs - lastFreeSpinMs >= FREE_SPIN_COOLDOWN_MS;

export const nextFreeSpinMs = (lastFreeSpinMs: number, nowMs: number): number =>
  Math.max(0, lastFreeSpinMs + FREE_SPIN_COOLDOWN_MS - nowMs);
