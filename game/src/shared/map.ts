import { MAP_SIZE, WORLD_RADIUS, type Vec2 } from './constants.js';
import { Rng } from './rng.js';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Poi {
  nameEs: string;
  nameEn: string;
  center: Vec2;
  radius: number;
  buildings: Rect[];
}

export interface GameMap {
  size: number;
  pois: Poi[];
  obstacles: Rect[];
  lootSpawns: Vec2[];
}

const POI_NAMES: Array<[string, string]> = [
  ['Puerto Nexo', 'Nexo Port'],
  ['Torres Gemelas de Cuarzo', 'Quartz Twin Towers'],
  ['Bosque de Antenas', 'Antenna Forest'],
  ['Cráter Aurora', 'Aurora Crater'],
  ['Mercado Flotante', 'Floating Market'],
  ['Refinería del Sol', 'Sun Refinery'],
  ['Jardines Colgantes', 'Hanging Gardens'],
  ['Estación Cero', 'Zero Station'],
];

const rectOverlapsAny = (r: Rect, rects: Rect[]): boolean =>
  rects.some(
    (o) =>
      r.x < o.x + o.w + 30 && r.x + r.w + 30 > o.x && r.y < o.y + o.h + 30 && r.y + r.h + 30 > o.y,
  );

export const generateMap = (seed: number): GameMap => {
  const rng = new Rng(seed);
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

    pois.push({ nameEs: POI_NAMES[i]![0], nameEn: POI_NAMES[i]![1], center, radius, buildings });
    obstacles.push(...buildings);

    const spawnCount = rng.int(6, 10);
    for (let s = 0; s < spawnCount; s++) {
      lootSpawns.push({
        x: center.x + rng.range(-radius, radius),
        y: center.y + rng.range(-radius, radius),
      });
    }
  }

  for (let t = 0; t < 90; t++) {
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

  return { size: MAP_SIZE, pois, obstacles, lootSpawns };
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
