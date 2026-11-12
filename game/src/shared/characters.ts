export type CharacterId = 'aurora' | 'sombra' | 'titan' | 'halcon' | 'vita' | 'vulcano';

export type AbilityId = 'muro' | 'sprint' | 'resistencia' | 'recarga' | 'pulso' | 'sobrecarga';

export interface AbilityDef {
  id: AbilityId;
  nameEs: string;
  nameEn: string;
  descEs: string;
  descEn: string;
  cooldownMs: number;
  durationMs: number;
}

export interface CharacterPassives {
  speedMult: number;
  reloadMult: number;
  resistance: number;
  rangeMult: number;
  healMult: number;
}

export interface CharacterDef {
  id: CharacterId;
  nameEs: string;
  nameEn: string;
  color: string;
  ability: AbilityDef;
  passives: CharacterPassives;
}

const WALL_MS = 12_000;

export const COVER_WALL = {
  width: 110,
  height: 16,
  hp: 250,
  durationMs: WALL_MS,
  deployDistance: 42,
};

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  aurora: {
    id: 'aurora',
    nameEs: 'Aurora',
    nameEn: 'Aurora',
    color: '#38e1c8',
    ability: {
      id: 'muro',
      nameEs: 'Muro de Cuarzo',
      nameEn: 'Quartz Wall',
      descEs: 'Despliega una cobertura instantánea frente a ti.',
      descEn: 'Deploys instant cover in front of you.',
      cooldownMs: 15_000,
      durationMs: WALL_MS,
    },
    passives: { speedMult: 1, reloadMult: 1, resistance: 1, rangeMult: 1, healMult: 1.15 },
  },
  sombra: {
    id: 'sombra',
    nameEs: 'Sombra',
    nameEn: 'Shadow',
    color: '#b06bff',
    ability: {
      id: 'sprint',
      nameEs: 'Sprint Sombra',
      nameEn: 'Shadow Sprint',
      descEs: 'Corre mucho más rápido durante unos segundos.',
      descEn: 'Run much faster for a few seconds.',
      cooldownMs: 10_000,
      durationMs: 2_500,
    },
    passives: { speedMult: 1.06, reloadMult: 1, resistance: 1, rangeMult: 1, healMult: 1 },
  },
  titan: {
    id: 'titan',
    nameEs: 'Titán',
    nameEn: 'Titan',
    color: '#f2b632',
    ability: {
      id: 'resistencia',
      nameEs: 'Piel de Titán',
      nameEn: 'Titan Skin',
      descEs: 'Reduce a la mitad el daño recibido durante 4 s.',
      descEn: 'Halves incoming damage for 4 s.',
      cooldownMs: 18_000,
      durationMs: 4_000,
    },
    passives: { speedMult: 1, reloadMult: 1, resistance: 0.92, rangeMult: 1, healMult: 1 },
  },
  halcon: {
    id: 'halcon',
    nameEs: 'Halcón',
    nameEn: 'Falcon',
    color: '#4ea1ff',
    ability: {
      id: 'recarga',
      nameEs: 'Recarga Táctica',
      nameEn: 'Tactical Reload',
      descEs: 'Recarga al instante el cargador del arma activa.',
      descEn: 'Instantly reloads the active weapon magazine.',
      cooldownMs: 12_000,
      durationMs: 0,
    },
    passives: { speedMult: 1, reloadMult: 0.94, resistance: 1, rangeMult: 1.15, healMult: 1 },
  },
  vita: {
    id: 'vita',
    nameEs: 'Vita',
    nameEn: 'Vita',
    color: '#4ade80',
    ability: {
      id: 'pulso',
      nameEs: 'Pulso Sanador',
      nameEn: 'Healing Pulse',
      descEs: 'Recupera 30 de vida al instante.',
      descEn: 'Instantly restores 30 health.',
      cooldownMs: 14_000,
      durationMs: 0,
    },
    passives: { speedMult: 1, reloadMult: 1, resistance: 1, rangeMult: 1, healMult: 1.25 },
  },
  vulcano: {
    id: 'vulcano',
    nameEs: 'Vulcano',
    nameEn: 'Volcano',
    color: '#ef5b6b',
    ability: {
      id: 'sobrecarga',
      nameEs: 'Sobrecarga',
      nameEn: 'Overcharge',
      descEs: '+30% de daño con el arma activa durante 3 s.',
      descEn: '+30% weapon damage for 3 s.',
      cooldownMs: 16_000,
      durationMs: 3_000,
    },
    passives: { speedMult: 1, reloadMult: 0.88, resistance: 1, rangeMult: 1, healMult: 1 },
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];

export const isCharacterId = (v: unknown): v is CharacterId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(CHARACTERS, v);

export const characterOf = (id: CharacterId): CharacterDef => CHARACTERS[id];

export const SLIDE_BOOST_MULT = 1.6;
export const SLIDE_DURATION_MS = 600;
export const SLIDE_COOLDOWN_MS = 2_000;
export const PRONE_SPEED_MULT = 0.45;
export const PRONE_RADIUS = 10;
export const SLIDE_RADIUS = 12;
