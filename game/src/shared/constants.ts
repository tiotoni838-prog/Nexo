export const PROTOCOL_VERSION = 1;

export const TICK_HZ = 30;
export const TICK_MS = 1000 / TICK_HZ;
export const SNAPSHOT_HZ = 15;

export const MAP_SIZE = 2400;
export const WORLD_RADIUS = MAP_SIZE / 2;

export const PLAYER_RADIUS = 14;
export const PLAYER_SPEED = 170;
export const MAX_HP = 100;
export const MAX_SHIELD = 100;

export const MAX_PLAYERS = 24;
export const MAX_BOTS = 23;

export const PICKUP_RADIUS = 26;
export const INVENTORY_SLOTS = 5;
export const MAX_STACK_HEAL = 5;
export const MAX_STACK_SHIELD_ITEM = 5;

export const MAX_INPUT_RATE_PER_SEC = 90;

export const RESPAWN_NONE = 0;

export type Vec2 = { x: number; y: number };

export const RarityLabels = ['comun', 'raro', 'epico', 'legendario'] as const;
export type Rarity = (typeof RarityLabels)[number];

export const RARITY_INDEX: Record<Rarity, number> = {
  comun: 0,
  raro: 1,
  epico: 2,
  legendario: 3,
};

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const dist2 = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const dist = (a: Vec2, b: Vec2): number => Math.sqrt(dist2(a, b));
