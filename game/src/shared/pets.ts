/** Mascotas: compañeros con bonos pasivos pequeños (nunca pay-to-win). */

export type PetId = 'cachorro' | 'gato' | 'zorro' | 'halcon' | 'robot' | 'dragon';

export interface PetDef {
  id: PetId;
  nameEs: string;
  nameEn: string;
  rarity: 'comun' | 'raro' | 'epico' | 'legendario';
  /** Multiplicador de velocidad de curación (1 = normal). */
  healMult: number;
  /** Multiplicador de velocidad de movimiento (1 = normal). */
  speedMult: number;
  /** Radio extra de detección de botín en el minimapa (px). */
  lootRadius: number;
  /** Munición extra al recoger cajas. */
  ammoBonus: number;
  descEs: string;
}

export const PETS: Record<PetId, PetDef> = {
  cachorro: {
    id: 'cachorro', nameEs: 'Cachorro', nameEn: 'Puppy', rarity: 'comun',
    healMult: 1.1, speedMult: 1, lootRadius: 0, ammoBonus: 0,
    descEs: 'Cura un poco más rápido contigo cerca.',
  },
  gato: {
    id: 'gato', nameEs: 'Gato', nameEn: 'Cat', rarity: 'comun',
    healMult: 1, speedMult: 1.03, lootRadius: 0, ammoBonus: 0,
    descEs: 'Un 3% más de velocidad al moverte.',
  },
  zorro: {
    id: 'zorro', nameEs: 'Zorro', nameEn: 'Fox', rarity: 'raro',
    healMult: 1, speedMult: 1.05, lootRadius: 120, ammoBonus: 0,
    descEs: 'Rápido y marca botín cercano en el minimapa.',
  },
  halcon: {
    id: 'halcon', nameEs: 'Halcón', nameEn: 'Falcon', rarity: 'epico',
    healMult: 1, speedMult: 1, lootRadius: 260, ammoBonus: 10,
    descEs: 'Ve el botín de lejos y trae munición extra.',
  },
  robot: {
    id: 'robot', nameEs: 'Robot', nameEn: 'Robot', rarity: 'raro',
    healMult: 1.15, speedMult: 1, lootRadius: 120, ammoBonus: 5,
    descEs: 'Asistente mecánico: cura más y recarga botín.',
  },
  dragon: {
    id: 'dragon', nameEs: 'Dragón pequeño', nameEn: 'Baby dragon', rarity: 'legendario',
    healMult: 1.2, speedMult: 1.05, lootRadius: 260, ammoBonus: 10,
    descEs: 'El compañero definitivo: pequeño bono en todo.',
  },
};

export const PET_IDS = Object.keys(PETS) as PetId[];

export const isPetId = (value: unknown): value is PetId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(PETS, value);

/** Nivel de mascota: sube con partidas jugadas (1 partida = 1 XP, máximo 30). */
export const PET_MAX_LEVEL = 30;

export const petLevelFromMatches = (matches: number): number =>
  Math.max(1, Math.min(PET_MAX_LEVEL, Math.floor(matches / 3) + 1));

/** El bono crece suavemente con el nivel: +8% del bono por nivel sobre la base. */
export const petEffective = (petId: PetId, level: number): PetDef => {
  const base = PETS[petId];
  const k = 1 + 0.08 * (Math.max(1, Math.min(PET_MAX_LEVEL, level)) - 1);
  return {
    ...base,
    healMult: Number((1 + (base.healMult - 1) * k).toFixed(3)),
    speedMult: Number((1 + (base.speedMult - 1) * k).toFixed(3)),
    lootRadius: Math.round(base.lootRadius * k),
    ammoBonus: Math.round(base.ammoBonus * k),
  };
};
