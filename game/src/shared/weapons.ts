import type { Rarity } from './constants.js';

export type WeaponId =
  | 'pistola'
  | 'revolver'
  | 'subfusil'
  | 'subfusil-compacto'
  | 'fusil'
  | 'fusil-batalla'
  | 'escopeta'
  | 'escopeta-doble'
  | 'francotirador'
  | 'precision'
  | 'ametralladora'
  | 'lanzacohetes';

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
  explosive?: boolean;
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
  ametralladora: {
    id: 'ametralladora',
    nameEs: 'Ametralladora Tormenta',
    nameEn: 'Storm LMG',
    damage: 13,
    fireIntervalMs: 110,
    spreadRad: 0.14,
    range: 480,
    magSize: 60,
    reloadMs: 3200,
    bulletSpeed: 680,
    pellets: 1,
  },
  // Arsenal extendido: 6 armas nuevas con daño inspirado en balística real
  // (calibres .357, 9mm compacto, 7.62, calibre 12 doble, .338, cohete HE).
  revolver: {
    id: 'revolver',
    nameEs: 'Revólver Magno',
    nameEn: 'Magnum Revolver',
    damage: 48,
    fireIntervalMs: 600,
    spreadRad: 0.03,
    range: 500,
    magSize: 6,
    reloadMs: 2400,
    bulletSpeed: 720,
    pellets: 1,
  },
  'subfusil-compacto': {
    id: 'subfusil-compacto',
    nameEs: 'Subfusil Compacto Vector',
    nameEn: 'Vector Compact SMG',
    damage: 9,
    fireIntervalMs: 70,
    spreadRad: 0.13,
    range: 320,
    magSize: 25,
    reloadMs: 1300,
    bulletSpeed: 640,
    pellets: 1,
  },
  'fusil-batalla': {
    id: 'fusil-batalla',
    nameEs: 'Fusil de Batalla Centinela',
    nameEn: 'Sentinel Battle Rifle',
    damage: 34,
    fireIntervalMs: 320,
    spreadRad: 0.035,
    range: 640,
    magSize: 20,
    reloadMs: 2200,
    bulletSpeed: 860,
    pellets: 1,
  },
  'escopeta-doble': {
    id: 'escopeta-doble',
    nameEs: 'Escopeta Doble Cañón',
    nameEn: 'Double-Barrel Shotgun',
    damage: 12,
    fireIntervalMs: 500,
    spreadRad: 0.3,
    range: 180,
    magSize: 2,
    reloadMs: 1600,
    bulletSpeed: 540,
    pellets: 8,
  },
  precision: {
    id: 'precision',
    nameEs: 'Fusil de Precisión Halcón',
    nameEn: 'Falcon Marksman Rifle',
    damage: 52,
    fireIntervalMs: 800,
    spreadRad: 0.015,
    range: 780,
    magSize: 10,
    reloadMs: 2300,
    bulletSpeed: 980,
    pellets: 1,
  },
  lanzacohetes: {
    id: 'lanzacohetes',
    nameEs: 'Lanzacohetes Titán',
    nameEn: 'Titan Rocket Launcher',
    damage: 95,
    fireIntervalMs: 2000,
    spreadRad: 0.01,
    range: 700,
    magSize: 1,
    reloadMs: 3400,
    bulletSpeed: 480,
    pellets: 1,
    explosive: true,
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

export const isWeaponId = (value: unknown): value is WeaponId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(WEAPONS, value);

export const EXPLOSION_RADIUS = 70;
export const EXPLOSION_DAMAGE = 55;

export const RARITY_DAMAGE_MULT: Record<Rarity, number> = {
  comun: 1,
  raro: 1.12,
  epico: 1.25,
  legendario: 1.4,
};

export type ConsumableId = 'botiquin' | 'escudo' | 'granada';

export const CONSUMABLES: Record<ConsumableId, { heal: number; shield: number; useMs: number }> = {
  botiquin: { heal: 50, shield: 0, useMs: 2000 },
  escudo: { heal: 0, shield: 50, useMs: 1500 },
  granada: { heal: 0, shield: 0, useMs: 0 },
};

export const GRENADE_RADIUS = 90;
export const GRENADE_DAMAGE = 85;
export const GRENADE_FUSE_MS = 1400;
export const GRENADE_SPEED = 420;
export const MAX_GRENADES = 3;
