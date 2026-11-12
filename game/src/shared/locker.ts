import { CHARACTERS, CHARACTER_IDS } from './characters.js';

/**
 * Armario (ropa) y evolutivas (maestría de personajes).
 * El armario guarda lo que posees y lo equipado; la maestría sube con XP
 * de partidas y desbloquea títulos cosméticos por personaje.
 * Persistencia: cliente (localStorage) hasta tener cuentas con base de datos.
 */

export type EquipSlot = 'skin' | 'trail' | 'banner' | 'emote';

export interface LockerState {
  owned: string[];
  equipped: Partial<Record<EquipSlot, string>>;
}

export const emptyLocker = (): LockerState => ({ owned: [], equipped: {} });

export const isOwned = (locker: LockerState, sku: string): boolean =>
  locker.owned.includes(sku);

export const ownItem = (locker: LockerState, sku: string): LockerState => {
  if (isOwned(locker, sku)) return locker;
  return { ...locker, owned: [...locker.owned, sku] };
};

export const equipItem = (
  locker: LockerState,
  slot: EquipSlot,
  sku: string,
): { locker: LockerState; error?: string } => {
  if (!isOwned(locker, sku)) return { locker, error: 'not-owned' };
  return { locker: { ...locker, equipped: { ...locker.equipped, [slot]: sku } } };
};

export const unequipSlot = (locker: LockerState, slot: EquipSlot): LockerState => {
  const equipped = { ...locker.equipped };
  delete equipped[slot];
  return { ...locker, equipped };
};

/** Evolutivas: maestría por personaje con umbrales de XP y título por nivel. */
export const MASTERY_XP_THRESHOLDS = [0, 500, 1500, 3000, 5000, 7500, 11000] as const;

export const MASTERY_TITLES_ES = [
  'Novato',
  'Aprendiz',
  'Combatiente',
  'Veterano',
  'Élite',
  'Maestro',
  'Leyenda',
] as const;

export const MASTERY_TITLES_EN = [
  'Rookie',
  'Apprentice',
  'Fighter',
  'Veteran',
  'Elite',
  'Master',
  'Legend',
] as const;

export const masteryLevel = (xp: number): number => {
  let level = 0;
  for (let i = 0; i < MASTERY_XP_THRESHOLDS.length; i++) {
    if (xp >= MASTERY_XP_THRESHOLDS[i]!) level = i;
  }
  return level;
};

export const masteryProgress = (
  xp: number,
): { level: number; progress: number; xpToNext: number | null } => {
  const level = masteryLevel(xp);
  if (level >= MASTERY_XP_THRESHOLDS.length - 1) {
    return { level, progress: 1, xpToNext: null };
  }
  const current = MASTERY_XP_THRESHOLDS[level]!;
  const next = MASTERY_XP_THRESHOLDS[level + 1]!;
  return {
    level,
    progress: (xp - current) / (next - current),
    xpToNext: next - xp,
  };
};

export const masteryTitle = (level: number, lang: 'es' | 'en' = 'es'): string =>
  lang === 'es'
    ? (MASTERY_TITLES_ES[Math.min(level, MASTERY_TITLES_ES.length - 1)] ?? 'Novato')
    : (MASTERY_TITLES_EN[Math.min(level, MASTERY_TITLES_EN.length - 1)] ?? 'Rookie');

export const masteryIsValidCharacter = (id: string): boolean =>
  (CHARACTER_IDS as readonly string[]).includes(id) && id in CHARACTERS;
