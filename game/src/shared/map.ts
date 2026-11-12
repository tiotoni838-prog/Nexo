import { MAP_SIZE, WORLD_RADIUS, type Vec2 } from './constants.js';
import { Rng } from './rng.js';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type LootTier = 'alto' | 'medio' | 'bajo';

export interface Poi {
  nameEs: string;
  nameEn: string;
  lootTier: LootTier;
  center: Vec2;
  radius: number;
  buildings: Rect[];
}

export interface GameMap {
  size: number;
  presetId: MapPresetId;
  nameEs: string;
  nameEn: string;
  palette: MapPalette;
  pois: Poi[];
  obstacles: Rect[];
  lootSpawns: Vec2[];
}

export interface MapPalette {
  ground: string;
  groundAlt: string;
  obstacle: string;
  obstacleTop: string;
  sky: string;
}

export type MapPresetId = 'nexo-urbano' | 'desierto-solar' | 'volcan-ceniza';

export const MAP_PRESETS: Record<
  MapPresetId,
  { nameEs: string; nameEn: string; palette: MapPalette; pois: Array<[string, string, LootTier]>; obstacleCount: number }
> = {
  'nexo-urbano': {
    nameEs: 'Nexo Urbano',
    nameEn: 'Nexo Urban',
    palette: {
      ground: '#1b2430',
      groundAlt: '#232f3d',
      obstacle: '#3a4a5e',
      obstacleTop: '#4d6178',
      sky: '#0b111a',
    },
    pois: [
      ['Puerto Nexo', 'Nexo Port', 'alto'],
      ['Torres Gemelas de Cuarzo', 'Quartz Twin Towers', 'alto'],
      ['Bosque de Antenas', 'Antenna Forest', 'bajo'],
      ['Cráter Aurora', 'Aurora Crater', 'medio'],
      ['Mercado Flotante', 'Floating Market', 'medio'],
      ['Refinería del Sol', 'Sun Refinery', 'alto'],
      ['Jardines Colgantes', 'Hanging Gardens', 'bajo'],
      ['Estación Cero', 'Zero Station', 'medio'],
    ],
    obstacleCount: 90,
  },
  'desierto-solar': {
    nameEs: 'Desierto Solar',
    nameEn: 'Solar Desert',
    palette: {
      ground: '#8a6b3d',
      groundAlt: '#9c7c48',
      obstacle: '#6b5230',
      obstacleTop: '#8a6b40',
      sky: '#2a1f10',
    },
    pois: [
      ['Cañón Rojo', 'Red Canyon', 'medio'],
      ['Pueblo Polvo', 'Dust Town', 'medio'],
      ['Ruinas del Sol', 'Sun Ruins', 'alto'],
      ['Pozo Seco', 'Dry Well', 'bajo'],
      ['Dunas Doradas', 'Golden Dunes', 'bajo'],
      ['Fuerte Calavera', 'Skull Fort', 'alto'],
      ['Oasis Espejo', 'Mirror Oasis', 'medio'],
      ['Mina Abandonada', 'Abandoned Mine', 'medio'],
    ],
    obstacleCount: 120,
  },
  'volcan-ceniza': {
    nameEs: 'Volcán Ceniza',
    nameEn: 'Ash Volcano',
    palette: {
      ground: '#2b1d1d',
      groundAlt: '#3a2626',
      obstacle: '#4a3030',
      obstacleTop: '#6b3f33',
      sky: '#160b0b',
    },
    pois: [
      ['Cráter Principal', 'Main Crater', 'alto'],
      ['Coladas de Lava', 'Lava Flows', 'medio'],
      ['Pueblo Ceniza', 'Ash Village', 'medio'],
      ['Grietas Rugientes', 'Roaring Fissures', 'bajo'],
      ['Observatorio Umbral', 'Threshold Observatory', 'alto'],
      ['Campo de Obsidiana', 'Obsidian Field', 'medio'],
      ['Refugio Subterráneo', 'Underground Shelter', 'medio'],
      ['Pico Tormenta', 'Storm Peak', 'bajo'],
    ],
    obstacleCount: 60,
  },
};

export const MAP_PRESET_IDS = Object.keys(MAP_PRESETS) as MapPresetId[];

export const isMapPresetId = (value: unknown): value is MapPresetId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(MAP_PRESETS, value);


const rectOverlapsAny = (r: Rect, rects: Rect[]): boolean =>
  rects.some(
    (o) =>
      r.x < o.x + o.w + 30 && r.x + r.w + 30 > o.x && r.y < o.y + o.h + 30 && r.y + r.h + 30 > o.y,
  );

export const generateMap = (seed: number, presetId: MapPresetId = 'nexo-urbano'): GameMap => {
  const preset = MAP_PRESETS[presetId];
  const rng = new Rng(seed ^ hashPreset(presetId));
  const pois: Poi[] = [];
  const obstacles: Rect[] = [];
  const lootSpawns: Vec2[] = [];

  const poiCount = 8;
  const minDistBetween = 520;

  for (let i = 0; i < poiCount; i++) {
    let center: Vec2 = { x: 0, y: 0 };
    let ok = false;
    for (let attempt = 0; attempt < 60 && !ok; attempt++) {
      center = {
        x: rng.range(-WORLD_RADIUS + 260, WORLD_RADIUS - 260),
        y: rng.range(-WORLD_RADIUS + 260, WORLD_RADIUS - 260),
      };
      ok = pois.every((p) => Math.hypot(p.center.x - center.x, p.center.y - center.y) > minDistBetween);
    }

    const radius = rng.range(110, 170);
    const buildings: Rect[] = [];
    const buildingCount = rng.int(3, 6);
    for (let b = 0; b < buildingCount; b++) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const w = rng.range(60, 130);
        const h = rng.range(60, 130);
        const rect: Rect = {
          x: center.x + rng.range(-radius, radius - w),
          y: center.y + rng.range(-radius, radius - h),
          w,
          h,
        };
        if (!rectOverlapsAny(rect, buildings)) {
          buildings.push(rect);
          break;
        }
      }
    }

    const tier = preset.pois[i]![2];
    pois.push({
      nameEs: preset.pois[i]![0],
      nameEn: preset.pois[i]![1],
      lootTier: tier,
      center,
      radius,
      buildings,
    });
    obstacles.push(...buildings);

    const spawnCount = tier === 'alto' ? rng.int(10, 14) : tier === 'medio' ? rng.int(6, 9) : rng.int(3, 5);
    for (let s = 0; s < spawnCount; s++) {
      lootSpawns.push({
        x: center.x + rng.range(-radius, radius),
        y: center.y + rng.range(-radius, radius),
      });
    }
  }

  for (let t = 0; t < preset.obstacleCount; t++) {
    const size = 16 + rng.next() * 22;
    const rect: Rect = {
      x: rng.range(-WORLD_RADIUS + 40, WORLD_RADIUS - 40 - size),
      y: rng.range(-WORLD_RADIUS + 40, WORLD_RADIUS - 40 - size),
      w: size,
      h: size,
    };
    if (!rectOverlapsAny(rect, obstacles)) {
      obstacles.push(rect);
      if (rng.chance(0.35)) lootSpawns.push({ x: rect.x + size / 2, y: rect.y + size / 2 });
    }
  }

  return {
    size: MAP_SIZE,
    presetId,
    nameEs: preset.nameEs,
    nameEn: preset.nameEn,
    palette: preset.palette,
    pois,
    obstacles,
    lootSpawns,
  };
};

const hashPreset = (presetId: MapPresetId): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < presetId.length; i++) {
    h ^= presetId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

export const pointInRect = (px: number, py: number, r: Rect): boolean =>
  px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

export const circleIntersectsRect = (cx: number, cy: number, radius: number, r: Rect): boolean => {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= radius * radius;
};

export const circleHitsObstacle = (
  cx: number,
  cy: number,
  radius: number,
  obstacles: Rect[],
): boolean => obstacles.some((o) => circleIntersectsRect(cx, cy, radius, o));

export const segmentHitsRect = (ax: number, ay: number, bx: number, by: number, r: Rect): boolean => {
  if (pointInRect(ax, ay, r) || pointInRect(bx, by, r)) return true;
  const segIntersect = (
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    p3x: number,
    p3y: number,
    p4x: number,
    p4y: number,
  ): boolean => {
    const d = (p2x - p1x) * (p4y - p3y) - (p2y - p1y) * (p4x - p3x);
    if (d === 0) return false;
    const t = ((p3x - p1x) * (p4y - p3y) - (p3y - p1y) * (p4x - p3x)) / d;
    const u = ((p3x - p1x) * (p2y - p1y) - (p3y - p1y) * (p2x - p1x)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  return (
    segIntersect(ax, ay, bx, by, r.x, r.y, r.x + r.w, r.y) ||
    segIntersect(ax, ay, bx, by, r.x + r.w, r.y, r.x + r.w, r.y + r.h) ||
    segIntersect(ax, ay, bx, by, r.x + r.w, r.y + r.h, r.x, r.y + r.h) ||
    segIntersect(ax, ay, bx, by, r.x, r.y + r.h, r.x, r.y)
  );
};
