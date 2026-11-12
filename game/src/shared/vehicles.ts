import type { MapPresetId } from './map.js';

/** Vehículos: terrestres y acuáticos. Los aéreos quedan en el ROADMAP. */

export type VehicleId = 'moto' | 'buggy' | 'todoterreno' | 'blindado' | 'bote';

export interface VehicleDef {
  id: VehicleId;
  nameEs: string;
  nameEn: string;
  speed: number;
  hp: number;
  seats: number;
  runOverDamage: number;
  noiseRadius: number;
  aquatic: boolean;
  descEs: string;
}

export const VEHICLES: Record<VehicleId, VehicleDef> = {
  moto: {
    id: 'moto', nameEs: 'Moto', nameEn: 'Bike',
    speed: 2.1, hp: 60, seats: 1, runOverDamage: 22, noiseRadius: 320, aquatic: false,
    descEs: 'La más rápida y ligera; se rompe rápido y no protege.',
  },
  buggy: {
    id: 'buggy', nameEs: 'Buggy', nameEn: 'Buggy',
    speed: 1.7, hp: 110, seats: 3, runOverDamage: 30, noiseRadius: 380, aquatic: false,
    descEs: 'Para cruzar el mapa en equipo; aguanta más que la moto.',
  },
  todoterreno: {
    id: 'todoterreno', nameEs: 'Todoterreno', nameEn: 'Off-road',
    speed: 1.5, hp: 160, seats: 4, runOverDamage: 34, noiseRadius: 400, aquatic: false,
    descEs: 'Resistente y estable; ideal para escuadrón.',
  },
  blindado: {
    id: 'blindado', nameEs: 'Blindado', nameEn: 'Armored truck',
    speed: 1.25, hp: 280, seats: 4, runOverDamage: 40, noiseRadius: 520, aquatic: false,
    descEs: 'Mucha vida y protección, pero lento y muy ruidoso. Raro: aparece en bases.',
  },
  bote: {
    id: 'bote', nameEs: 'Bote', nameEn: 'Boat',
    speed: 1.8, hp: 90, seats: 3, runOverDamage: 18, noiseRadius: 300, aquatic: true,
    descEs: 'Cruza ríos y lagos con 2 o 3 personas.',
  },
};

export const VEHICLE_IDS = Object.keys(VEHICLES) as VehicleId[];

export const isVehicleId = (value: unknown): value is VehicleId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(VEHICLES, value);

/** Daño de atropello escalado por velocidad actual relativa a la máxima. */
export const runOverDamageAt = (vehicleId: VehicleId, speedFraction: number): number => {
  const def = VEHICLES[vehicleId];
  const f = Math.max(0, Math.min(1, speedFraction));
  return Math.round(def.runOverDamage * (0.35 + 0.65 * f));
};

/**
 * Aparición: en caminos y garajes cerca de POIs. Determinista por semilla.
 * Los blindados solo en mapas militares (volcán), los botes junto al agua exterior.
 */
export const vehicleSpawnsForMap = (
  mapId: MapPresetId,
  worldRadius: number,
): Array<{ id: VehicleId; x: number; y: number }> => {
  const spawns: Array<{ id: VehicleId; x: number; y: number }> = [];
  const ring = worldRadius * 0.55;
  const common: VehicleId[] = mapId === 'volcan-ceniza' ? ['moto', 'todoterreno', 'blindado', 'buggy'] : ['moto', 'buggy', 'todoterreno'];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6;
    spawns.push({
      id: common[i % common.length]!,
      x: Math.round(Math.cos(angle) * ring),
      y: Math.round(Math.sin(angle) * ring),
    });
  }
  spawns.push({ id: 'bote', x: Math.round(-worldRadius * 0.7), y: 0 });
  spawns.push({ id: 'bote', x: Math.round(worldRadius * 0.7), y: 0 });
  return spawns;
};
