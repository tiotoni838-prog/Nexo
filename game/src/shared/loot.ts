import { MAX_SHIELD, type Rarity, type Vec2 } from './constants.js';
import {
  CONSUMABLES,
  MAX_GRENADES,
  WEAPONS,
  type ConsumableId,
  type WeaponId,
} from './weapons.js';
import { Rng } from './rng.js';

export type ItemKind = 'weapon' | 'consumable' | 'ammo' | 'shieldcore';

export interface GroundItem {
  id: number;
  pos: Vec2;
  kind: ItemKind;
  weaponId?: WeaponId;
  consumableId?: ConsumableId;
  rarity: Rarity;
  amount?: number;
}

export interface Inventory {
  weapons: Array<{ weaponId: WeaponId; rarity: Rarity; ammoInMag: number } | null>;
  activeWeapon: number;
  botiquines: number;
  escudos: number;
  grenades: number;
  ammo: number;
}

export const emptyInventory = (): Inventory => ({
  weapons: [null, null],
  activeWeapon: 0,
  botiquines: 0,
  escudos: 0,
  grenades: 0,
  ammo: 0,
});

const RARITY_WEIGHTS: Array<[Rarity, number]> = [
  ['comun', 50],
  ['raro', 28],
  ['epico', 15],
  ['legendario', 7],
];

export const rollRarity = (rng: Rng): Rarity => {
  const total = RARITY_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [rarity, w] of RARITY_WEIGHTS) {
    roll -= w;
    if (roll <= 0) return rarity;
  }
  return 'comun';
};

let nextItemId = 1;
export const resetItemIds = (): void => {
  nextItemId = 1;
};

export const spawnLootAt = (rng: Rng, pos: Vec2, forceWeapon = false): GroundItem => {
  const rarity = rollRarity(rng);
  const roll = forceWeapon ? 0.55 : rng.next();
  if (roll < 0.5) {
    return {
      id: nextItemId++,
      pos: { ...pos },
      kind: 'weapon',
      weaponId: rng.pick(Object.keys(WEAPONS) as WeaponId[]),
      rarity,
    };
  }
  if (roll < 0.75) {
    const consumableRoll = rng.next();
    return {
      id: nextItemId++,
      pos: { ...pos },
      kind: 'consumable',
      consumableId: consumableRoll < 0.5 ? 'botiquin' : consumableRoll < 0.85 ? 'escudo' : 'granada',
      rarity: 'comun',
      amount: 1,
    };
  }
  if (roll < 0.92) {
    return { id: nextItemId++, pos: { ...pos }, kind: 'ammo', rarity: 'comun', amount: 24 };
  }
  return {
    id: nextItemId++,
    pos: { ...pos },
    kind: 'shieldcore',
    rarity,
    amount: Math.min(MAX_SHIELD, 25 + Math.round(rarity.length * 5)),
  };
};

export const itemLabelEs = (item: GroundItem): string => {
  switch (item.kind) {
    case 'weapon':
      return `${WEAPONS[item.weaponId!].nameEs} (${item.rarity})`;
    case 'consumable':
      return item.consumableId === 'botiquin'
        ? 'Botiquín'
        : item.consumableId === 'escudo'
          ? 'Celda de escudo'
          : 'Granada';
    case 'ammo':
      return 'Munición';
    case 'shieldcore':
      return 'Núcleo de escudo';
  }
};

export const itemLabelEn = (item: GroundItem): string => {
  switch (item.kind) {
    case 'weapon':
      return `${WEAPONS[item.weaponId!].nameEn} (${item.rarity})`;
    case 'consumable':
      return item.consumableId === 'botiquin'
        ? 'Medkit'
        : item.consumableId === 'escudo'
          ? 'Shield cell'
          : 'Grenade';
    case 'ammo':
      return 'Ammo';
    case 'shieldcore':
      return 'Shield core';
  }
};

export const consumableDef = (id: ConsumableId) => CONSUMABLES[id];
export { MAX_GRENADES };
