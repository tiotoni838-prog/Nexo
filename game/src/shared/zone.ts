import { MAP_SIZE, WORLD_RADIUS, clamp } from './constants.js';
import { Rng } from './rng.js';

export interface ZonePhase {
  waitMs: number;
  shrinkMs: number;
  radiusFactor: number;
  dps: number;
}

export const ZONE_PHASES: ZonePhase[] = [
  { waitMs: 25_000, shrinkMs: 30_000, radiusFactor: 0.62, dps: 2 },
  { waitMs: 20_000, shrinkMs: 25_000, radiusFactor: 0.55, dps: 5 },
  { waitMs: 15_000, shrinkMs: 20_000, radiusFactor: 0.5, dps: 8 },
  { waitMs: 12_000, shrinkMs: 18_000, radiusFactor: 0.45, dps: 12 },
  { waitMs: 10_000, shrinkMs: 15_000, radiusFactor: 0.0, dps: 18 },
];

export interface ZoneState {
  phase: number;
  mode: 'wait' | 'shrink' | 'closed';
  timerMs: number;
  cx: number;
  cy: number;
  radius: number;
  targetCx: number;
  targetCy: number;
  targetRadius: number;
  startCx: number;
  startCy: number;
  startRadius: number;
}

export const initialZone = (rng: Rng): ZoneState => {
  const radius = WORLD_RADIUS * 0.92;
  const maxOffset = WORLD_RADIUS - radius;
  const cx = rng.range(-maxOffset, maxOffset);
  const cy = rng.range(-maxOffset, maxOffset);
  return {
    phase: 0,
    mode: 'wait',
    timerMs: ZONE_PHASES[0]!.waitMs,
    cx,
    cy,
    radius,
    targetCx: cx,
    targetCy: cy,
    targetRadius: radius,
    startCx: cx,
    startCy: cy,
    startRadius: radius,
  };
};

const computeTarget = (zone: ZoneState, rng: Rng): void => {
  const phase = ZONE_PHASES[zone.phase]!;
  const nextRadius = zone.radius * phase.radiusFactor;
  const travel = zone.radius - nextRadius;
  const maxOffset = Math.max(0, zone.radius - nextRadius);
  const angle = rng.next() * Math.PI * 2;
  const offset = rng.next() * maxOffset * 0.7;
  zone.targetRadius = nextRadius;
  zone.targetCx = clamp(
    zone.cx + Math.cos(angle) * offset,
    -WORLD_RADIUS + nextRadius,
    WORLD_RADIUS - nextRadius,
  );
  zone.targetCy = clamp(
    zone.cy + Math.sin(angle) * offset,
    -WORLD_RADIUS + nextRadius,
    WORLD_RADIUS - nextRadius,
  );
  void travel;
};

export const updateZone = (zone: ZoneState, dtMs: number, rng: Rng): void => {
  if (zone.mode === 'closed') return;

  zone.timerMs -= dtMs;

  if (zone.mode === 'wait') {
    if (zone.timerMs <= 0) {
      computeTarget(zone, rng);
      zone.mode = 'shrink';
      zone.timerMs = ZONE_PHASES[zone.phase]!.shrinkMs;
      zone.startCx = zone.cx;
      zone.startCy = zone.cy;
      zone.startRadius = zone.radius;
    }
    return;
  }

  if (zone.mode === 'shrink') {
    const phase = ZONE_PHASES[zone.phase]!;
    const t = clamp(1 - zone.timerMs / phase.shrinkMs, 0, 1);
    zone.cx = zone.startCx + (zone.targetCx - zone.startCx) * t;
    zone.cy = zone.startCy + (zone.targetCy - zone.startCy) * t;
    zone.radius = zone.startRadius + (zone.targetRadius - zone.startRadius) * t;
    if (zone.timerMs <= 0) {
      zone.cx = zone.targetCx;
      zone.cy = zone.targetCy;
      zone.radius = zone.targetRadius;
      if (zone.phase >= ZONE_PHASES.length - 1 || zone.radius <= 1) {
        zone.mode = 'closed';
        zone.timerMs = 0;
      } else {
        zone.phase += 1;
        zone.mode = 'wait';
        zone.timerMs = ZONE_PHASES[zone.phase]!.waitMs;
      }
    }
  }
};

export const zoneDps = (zone: ZoneState): number => {
  if (zone.mode === 'closed') return ZONE_PHASES[ZONE_PHASES.length - 1]!.dps;
  return ZONE_PHASES[zone.phase]!.dps;
};

export const isOutsideZone = (x: number, y: number, zone: ZoneState): boolean => {
  const dx = x - zone.cx;
  const dy = y - zone.cy;
  return dx * dx + dy * dy > zone.radius * zone.radius;
};

export const nextPhaseCountdownMs = (zone: ZoneState): number => zone.timerMs;
