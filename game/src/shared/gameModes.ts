import type { WeaponId } from './weapons.js';
import type { MapPresetId } from './map.js';

/**
 * Modos de juego. Los modos marcados `implemented` cambian la simulación real;
 * el resto quedan definidos para el ROADMAP (documentado honestamente).
 */
export type GameModeId =
  | 'solo'
  | 'duplicado'
  | 'escuadron'
  | 'clasificatorio'
  | 'rapido'
  | 'mini'
  | 'solo-pistolas'
  | 'francotiradores'
  | 'armas-gigantes'
  | 'noche'
  | 'infectados'
  | 'tdm'
  | 'practica'
  | 'creativo';

export interface GameModeDef {
  id: GameModeId;
  nameEs: string;
  nameEn: string;
  implemented: boolean;
  ranked: boolean;
  teamSize: number;
  zoneSpeedMult: number;
  allowedWeapons?: WeaponId[];
  /** Multiplicador de daño de armas (modo "armas gigantes"). */
  damageMult?: number;
  /** Fuerza noche permanente (linterna/visibilidad reducida en el cliente). */
  forcedNight?: boolean;
  descEs: string;
  descEn: string;
}

export const GAME_MODES: Record<GameModeId, GameModeDef> = {
  solo: {
    id: 'solo', nameEs: 'Solo', nameEn: 'Solo', implemented: true, ranked: false,
    teamSize: 1, zoneSpeedMult: 1,
    descEs: 'El clásico: tú contra todos.', descEn: 'The classic: you vs everyone.',
  },
  duplicado: {
    id: 'duplicado', nameEs: 'Dúo', nameEn: 'Duo', implemented: false, ranked: false,
    teamSize: 2, zoneSpeedMult: 1,
    descEs: 'Con un compañero (ROADMAP: equipos persistentes).', descEn: 'With a partner (ROADMAP: persistent teams).',
  },
  escuadron: {
    id: 'escuadron', nameEs: 'Escuadrón', nameEn: 'Squad', implemented: false, ranked: false,
    teamSize: 4, zoneSpeedMult: 1,
    descEs: 'Equipos de 4 (ROADMAP).', descEn: '4-player teams (ROADMAP).',
  },
  clasificatorio: {
    id: 'clasificatorio', nameEs: 'Clasificatorio', nameEn: 'Ranked', implemented: true, ranked: true,
    teamSize: 1, zoneSpeedMult: 1,
    descEs: 'Sube de Bronce a Nexo con tus resultados.', descEn: 'Climb from Bronze to Nexo with your results.',
  },
  rapido: {
    id: 'rapido', nameEs: 'Modo Rápido', nameEn: 'Rapid Mode', implemented: true, ranked: false,
    teamSize: 1, zoneSpeedMult: 2.2,
    descEs: 'Partidas cortas: la zona cierra al doble de velocidad.', descEn: 'Short matches: zone closes twice as fast.',
  },
  mini: {
    id: 'mini', nameEs: 'Mini BR', nameEn: 'Mini BR', implemented: true, ranked: false,
    teamSize: 1, zoneSpeedMult: 3,
    descEs: 'Mapa pequeño y zona veloz: partidas de 5 minutos.', descEn: 'Small map, fast zone: 5-minute matches.',
  },
  'solo-pistolas': {
    id: 'solo-pistolas', nameEs: 'Solo Pistolas', nameEn: 'Pistols Only', implemented: true, ranked: false,
    teamSize: 1, zoneSpeedMult: 1.4,
    allowedWeapons: ['pistola', 'revolver'],
    descEs: 'Solo pistolas y revólveres caen del cielo.', descEn: 'Only pistols and revolvers drop.',
  },
  francotiradores: {
    id: 'francotiradores', nameEs: 'Solo Francotiradores', nameEn: 'Snipers Only', implemented: true, ranked: false,
    teamSize: 1, zoneSpeedMult: 1,
    allowedWeapons: ['francotirador', 'precision'],
    descEs: 'Solo armas de largo alcance: puntería pura.', descEn: 'Long-range weapons only: pure aim.',
  },
  'armas-gigantes': {
    id: 'armas-gigantes', nameEs: 'Armas Gigantes', nameEn: 'Giant Weapons', implemented: true, ranked: false,
    teamSize: 1, zoneSpeedMult: 1.2, damageMult: 2,
    descEs: 'Todo hace el doble de daño y suena el doble de fuerte.', descEn: 'Everything deals double damage.',
  },
  noche: {
    id: 'noche', nameEs: 'Modo Noche', nameEn: 'Night Mode', implemented: true, ranked: false,
    teamSize: 1, zoneSpeedMult: 1, forcedNight: true,
    descEs: 'Oscuridad permanente: linternas y emboscadas.', descEn: 'Permanent darkness: flashlights and ambushes.',
  },
  infectados: {
    id: 'infectados', nameEs: 'Infectados', nameEn: 'Infected', implemented: false, ranked: false,
    teamSize: 1, zoneSpeedMult: 1,
    descEs: 'Modo zombi (ROADMAP).', descEn: 'Zombie mode (ROADMAP).',
  },
  tdm: {
    id: 'tdm', nameEs: 'Combate por Equipos', nameEn: 'Team Deathmatch', implemented: false, ranked: false,
    teamSize: 4, zoneSpeedMult: 1,
    descEs: 'Gana quien sume más bajas (ROADMAP).', descEn: 'Most kills wins (ROADMAP).',
  },
  practica: {
    id: 'practica', nameEs: 'Práctica', nameEn: 'Practice', implemented: true, ranked: false,
    teamSize: 1, zoneSpeedMult: 0.5,
    descEs: 'Campo de entrenamiento con bots y zona lenta.', descEn: 'Training ground with slow zone.',
  },
  creativo: {
    id: 'creativo', nameEs: 'Creativo', nameEn: 'Creative', implemented: false, ranked: false,
    teamSize: 1, zoneSpeedMult: 1,
    descEs: 'Crea tus propias reglas y mapas (ROADMAP).', descEn: 'Build your own rules and maps (ROADMAP).',
  },
};

export const GAME_MODE_IDS = Object.keys(GAME_MODES) as GameModeId[];

export const isGameModeId = (value: unknown): value is GameModeId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(GAME_MODES, value);

export const isWeaponAllowedInMode = (mode: GameModeDef, weaponId: WeaponId): boolean =>
  !mode.allowedWeapons || mode.allowedWeapons.includes(weaponId);

export const mapForMode = (modeId: GameModeId, seed: number): MapPresetId => {
  const presets: MapPresetId[] = ['nexo-urbano', 'desierto-solar', 'volcan-ceniza'];
  if (modeId === 'rapido' || modeId === 'mini') return presets[seed % presets.length]!;
  return 'nexo-urbano';
};
