import type { Rarity } from './constants.js';

export type WeaponId = 'pistola' | 'subfusil' | 'fusil' | 'escopeta' | 'francotirador';

export interface WeaponDef {
  id: WeaponId;
  nameEs: string;
  nameEn: string;
  damage: number;
  fireIntervalMs: number;
  spreadRad: number;
  range: number;
  magSize: number;
  reloadMs: number;
  bulletSpeed: number;
  pellets: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistola: {
    id: 'pistola',
    nameEs: 'Pistola Chispa',
    nameEn: 'Spark Pistol',
    damage: 16,
    fireIntervalMs: 220,
    spreadRad: 0.05,
    range: 420,
    magSize: 12,
    reloadMs: 1100,
    bulletSpeed: 620,
    pellets: 1,
  },
  subfusil: {
    id: 'subfusil',
    nameEs: 'Subfusil Zumbido',
    nameEn: 'Hum SMG',
    damage: 11,
    fireIntervalMs: 95,
    spreadRad: 0.11,
    range: 380,
    magSize: 30,
    reloadMs: 1500,
    bulletSpeed: 660,
    pellets: 1,
  },
  fusil: {
    id: 'fusil',
    nameEs: 'Fusil Eco',
    nameEn: 'Echo Rifle',
    damage: 20,
    fireIntervalMs: 150,
    spreadRad: 0.06,
    range: 560,
    magSize: 25,
    reloadMs: 1800,
    bulletSpeed: 760,
    pellets: 1,
  },
  escopeta: {
    id: 'escopeta',
    nameEs: 'Escopeta Trueno',
    nameEn: 'Thunder Shotgun',
    damage: 9,
    fireIntervalMs: 750,
    spreadRad: 0.22,
    range: 220,
    magSize: 6,
    reloadMs: 2100,
    bulletSpeed: 560,
    pellets: 6,
  },
  francotirador: {
    id: 'francotirador',
    nameEs: 'Francotirador Silencio',
    nameEn: 'Silence Sniper',
    damage: 70,
    fireIntervalMs: 1300,
    spreadRad: 0.008,
    range: 900,
    magSize: 5,
    reloadMs: 2600,
    bulletSpeed: 1100,
    pellets: 1,
  },
};

export const RARITY_DAMAGE_MULT: Record<Rarity, number> = {
  comun: 1,
  raro: 1.12,
  epico: 1.25,
  legendario: 1.4,
};

export type ConsumableId = 'botiquin' | 'escudo';

export const CONSUMABLES: Record<ConsumableId, { heal: number; shield: number; useMs: number }> = {
  botiquin: { heal: 50, shield: 0, useMs: 2000 },
  escudo: { heal: 0, shield: 50, useMs: 1500 },
};
