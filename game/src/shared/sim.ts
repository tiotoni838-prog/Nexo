import {
  MAX_HP,
  MAX_SHIELD,
  PICKUP_RADIUS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  TICK_MS,
  WORLD_RADIUS,
  clamp,
  dist,
  type Vec2,
} from './constants.js';
import { Rng } from './rng.js';
import {
  generateMap,
  circleHitsObstacle,
  segmentHitsRect,
  type GameMap,
  type Rect,
  type MapPresetId,
} from './map.js';
import { GAME_MODES, isGameModeId, type GameModeId } from './gameModes.js';
import {
  emptyInventory,
  resetItemIds,
  spawnLootAt,
  type GroundItem,
  type Inventory,
} from './loot.js';
import {
  EXPLOSION_DAMAGE,
  EXPLOSION_RADIUS,
  GRENADE_DAMAGE,
  GRENADE_FUSE_MS,
  GRENADE_RADIUS,
  GRENADE_SPEED,
  MAX_GRENADES,
  RARITY_DAMAGE_MULT,
  WEAPONS,
  type WeaponId,
  type ConsumableId,
} from './weapons.js';
import { initialZone, isOutsideZone, updateZone, zoneDps, type ZoneState } from './zone.js';
import { sanitizeName } from './validation.js';
import {
  VEHICLES,
  isVehicleId,
  runOverDamageAt,
  vehicleSpawnsForMap,
  type VehicleId,
} from './vehicles.js';
import { PETS, isPetId, petEffective, type PetId } from './pets.js';
import {
  CHARACTERS,
  CHARACTER_IDS,
  COVER_WALL,
  PRONE_RADIUS,
  PRONE_SPEED_MULT,
  SLIDE_BOOST_MULT,
  SLIDE_COOLDOWN_MS,
  SLIDE_DURATION_MS,
  SLIDE_RADIUS,
  type AbilityId,
  type CharacterId,
} from './characters.js';

export type MatchPhase = 'lobby' | 'drop' | 'play' | 'over';

export interface PlayerInput {
  mx: number;
  my: number;
  aim: number;
  fire: boolean;
  seq: number;
  slide?: boolean;
  prone?: boolean;
}

export interface Vehicle {
  id: number;
  kind: VehicleId;
  x: number;
  y: number;
  aim: number;
  hp: number;
  driverId: number | null;
  speedFrac: number;
  lastRunOverMs: number;
}

export interface SimPlayer {
  id: number;
  name: string;
  bot: boolean;
  x: number;
  y: number;
  aim: number;
  hp: number;
  shield: number;
  alive: boolean;
  kills: number;
  grenades: number;
  inventory: Inventory;
  input: PlayerInput;
  lastFireMs: number;
  reloadEndMs: number;
  firing: boolean;
  landing: boolean;
  dropChoice: Vec2 | null;
  placement: number;
  characterId: CharacterId;
  abilityReadyMs: number;
  abilityEndsAtMs: number;
  prone: boolean;
  sliding: boolean;
  slideEndsAtMs: number;
  nextSlideMs: number;
  petId: PetId | null;
  petLevel: number;
}

export interface CoverWall {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  expiresAtMs: number;
  ownerId: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: number;
  damage: number;
  traveled: number;
  range: number;
  explosive?: boolean;
}

export interface Grenade {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: number;
  fuseMs: number;
}

export interface SimEvent {
  kind: 'kill' | 'shot' | 'hit' | 'pickup' | 'zone' | 'explosion' | 'airdrop' | 'ability' | 'vehicle';
  killerId?: number;
  killerName?: string;
  victimId?: number;
  victimName?: string;
  weaponId?: WeaponId;
  x?: number;
  y?: number;
  playerId?: number;
  itemName?: string;
  abilityId?: AbilityId;
}

export interface MatchConfig {
  seed: number;
  botCount: number;
  dropPhaseMs: number;
  mapId?: MapPresetId;
  modeId?: GameModeId;
  petId?: PetId | null;
  petLevel?: number;
}

const BOT_NAMES_ES = [
  'Vega', 'Orion', 'Lyra', 'Atlas', 'Nova', 'Ciro', 'Mira', 'Deneb', 'Altair', 'Rigel',
  'Sirio', 'Castor', 'Polar', 'Helio', 'Selene', 'Zephyr', 'Ion', 'Kraken', 'Vortex', 'Quasar',
];

const normalizeInput = (input: PlayerInput): PlayerInput => {
  const mx = clamp(Number.isFinite(input.mx) ? input.mx : 0, -1, 1);
  const my = clamp(Number.isFinite(input.my) ? input.my : 0, -1, 1);
  const aim = Number.isFinite(input.aim) ? input.aim : 0;
  const len = Math.hypot(mx, my);
  if (len <= 1 || len === 0) {
    return { ...input, mx, my, aim };
  }
  return { ...input, mx: mx / len, my: my / len, aim };
};

const resolveCircleRectCollision = (px: number, py: number, r: Rect): Vec2 => {
  const nx = clamp(px, r.x, r.x + r.w);
  const ny = clamp(py, r.y, r.y + r.h);
  const dx = px - nx;
  const dy = py - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > PLAYER_RADIUS * PLAYER_RADIUS) return { x: px, y: py };
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    const push = PLAYER_RADIUS - d;
    return { x: px + (dx / d) * push, y: py + (dy / d) * push };
  }
  const left = px - r.x;
  const right = r.x + r.w - px;
  const top = py - r.y;
  const bottom = r.y + r.h - py;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: r.x - PLAYER_RADIUS, y: py };
  if (m === right) return { x: r.x + r.w + PLAYER_RADIUS, y: py };
  if (m === top) return { x: px, y: r.y - PLAYER_RADIUS };
  return { x: px, y: r.y + r.h + PLAYER_RADIUS };
};

export class MatchSim {
  readonly map: GameMap;
  readonly seed: number;
  phase: MatchPhase = 'lobby';
  timeMs = 0;
  tickCount = 0;
  zone: ZoneState;
  players: SimPlayer[] = [];
  bullets: Bullet[] = [];
  grenades: Grenade[] = [];
  items: GroundItem[] = [];
  walls: CoverWall[] = [];
  vehicles: Vehicle[] = [];
  airdropTimerMs = 45_000;
  redZone: { x: number; y: number; r: number; untilMs: number } | null = null;
  redZoneNextMs = 50_000;
  redZoneBombMs = 0;
  events: SimEvent[] = [];
  dropEndsAtMs: number;
  mode: (typeof GAME_MODES)[GameModeId];
  winnerId: number | null = null;
  private rng: Rng;
  private nextPlayerId = 1;
  private nextBulletId = 1;
  private nextGrenadeId = 1;
  private nextWallId = 1;
  private nextVehicleId = 1;
  private nextPlacement = 0;
  private totalPlayers = 0;

  constructor(config: MatchConfig) {
    this.seed = config.seed;
    this.rng = new Rng(config.seed ^ 0x5f3759df);
    this.map = generateMap(config.seed, config.mapId ?? 'nexo-urbano');
    this.mode = isGameModeId(config.modeId) ? GAME_MODES[config.modeId] : GAME_MODES.solo;
    this.zone = initialZone(this.rng);
    this.dropEndsAtMs = config.dropPhaseMs;
    resetItemIds();
    for (const p of this.map.pois) {
      for (const b of p.buildings) {
        this.items.push(spawnLootAt(this.rng, { x: b.x + b.w / 2, y: b.y + b.h / 2 }));
      }
    }
    for (const s of this.map.lootSpawns) {
      if (this.rng.chance(0.6)) this.items.push(spawnLootAt(this.rng, s));
    }
    if (this.mode.allowedWeapons) {
      const allowed = this.mode.allowedWeapons;
      for (const item of this.items) {
        if (item.kind === 'weapon' && item.weaponId && !allowed.includes(item.weaponId)) {
          item.weaponId = allowed[Math.floor(this.rng.next() * allowed.length)]!;
        }
      }
    }
    for (const spawn of vehicleSpawnsForMap(this.map.presetId, WORLD_RADIUS)) {
      const def = VEHICLES[spawn.id];
      this.vehicles.push({
        id: this.nextVehicleId++,
        kind: spawn.id,
        x: spawn.x,
        y: spawn.y,
        aim: this.rng.range(0, Math.PI * 2),
        hp: def.hp,
        driverId: null,
        speedFrac: 0,
        lastRunOverMs: -9999,
      });
    }
    for (let i = 0; i < config.botCount; i++) {
      this.addBot(`BOT ${BOT_NAMES_ES[i % BOT_NAMES_ES.length]}`);
    }
    this.configPet = config.petId && isPetId(config.petId) ? { id: config.petId, level: config.petLevel ?? 1 } : null;
  }

  private configPet: { id: PetId; level: number } | null;

  private randomSpawn(): Vec2 {
    for (let i = 0; i < 50; i++) {
      const x = this.rng.range(-WORLD_RADIUS + 80, WORLD_RADIUS - 80);
      const y = this.rng.range(-WORLD_RADIUS + 80, WORLD_RADIUS - 80);
      if (!circleHitsObstacle(x, y, PLAYER_RADIUS, this.map.obstacles)) return { x, y };
    }
    return { x: 0, y: 0 };
  }

  addPlayer(name: string, bot: boolean, characterId?: CharacterId): SimPlayer {
    const spawn = this.randomSpawn();
    const cid: CharacterId =
      characterId && CHARACTER_IDS.includes(characterId)
        ? characterId
        : this.rng.pick(CHARACTER_IDS);
    const player: SimPlayer = {
      id: this.nextPlayerId++,
      name: sanitizeName(name),
      bot,
      x: spawn.x,
      y: spawn.y,
      aim: 0,
      hp: MAX_HP,
      shield: 0,
      alive: true,
      kills: 0,
      grenades: 0,
      inventory: emptyInventory(),
      input: { mx: 0, my: 0, aim: 0, fire: false, seq: 0 },
      lastFireMs: -9999,
      reloadEndMs: -1,
      firing: false,
      landing: false,
      dropChoice: null,
      placement: 0,
      characterId: cid,
      abilityReadyMs: 0,
      abilityEndsAtMs: -1,
      prone: false,
      sliding: false,
      slideEndsAtMs: -1,
      nextSlideMs: 0,
      petId: !bot && this.configPet ? this.configPet.id : null,
      petLevel: !bot && this.configPet ? this.configPet.level : 1,
    };
    this.players.push(player);
    this.totalPlayers += 1;
    return player;
  }

  addBot(name: string): SimPlayer {
    return this.addPlayer(name, true);
  }

  startDrop(): void {
    if (this.phase !== 'lobby') return;
    this.phase = 'drop';
    this.timeMs = 0;
    for (const p of this.players) p.landing = true;
  }

  chooseDrop(playerId: number, x: number, y: number): boolean {
    if (this.phase !== 'drop') return false;
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.alive) return false;
    const cx = clamp(x, -WORLD_RADIUS + 40, WORLD_RADIUS - 40);
    const cy = clamp(y, -WORLD_RADIUS + 40, WORLD_RADIUS - 40);
    player.dropChoice = { x: cx, y: cy };
    return true;
  }

  private landPlayer(player: SimPlayer): void {
    let pos = player.dropChoice ?? { x: this.zone.cx, y: this.zone.cy };
    if (circleHitsObstacle(pos.x, pos.y, PLAYER_RADIUS, this.map.obstacles)) {
      pos = this.randomSpawn();
    }
    player.x = pos.x;
    player.y = pos.y;
    player.landing = false;
    player.dropChoice = null;
  }

  setInput(playerId: number, input: PlayerInput): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.alive) return;
    player.input = normalizeInput({ ...input, aim: input.aim });
  }

  vehicleOf(playerId: number): Vehicle | null {
    return this.vehicles.find((v) => v.driverId === playerId) ?? null;
  }

  /** Subirse al vehículo más cercano (≤ 70 px) o bajarse del actual. */
  toggleVehicle(playerId: number): boolean {
    if (this.phase !== 'play') return false;
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.alive || player.landing) return false;
    const current = this.vehicleOf(playerId);
    if (current) {
      current.driverId = null;
      current.speedFrac = 0;
      player.x = current.x + Math.cos(current.aim + Math.PI / 2) * (PLAYER_RADIUS + 26);
      player.y = current.y + Math.sin(current.aim + Math.PI / 2) * (PLAYER_RADIUS + 26);
      return true;
    }
    let best: Vehicle | null = null;
    let bestD = 70;
    for (const v of this.vehicles) {
      if (v.driverId !== null) continue;
      const d = dist(player, v);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (!best) return false;
    best.driverId = player.id;
    best.speedFrac = 0;
    return true;
  }

  private drivingVehicle(player: SimPlayer): Vehicle | null {
    return this.vehicleOf(player.id);
  }

  private stepVehicles(dtMs: number): void {
    for (const v of this.vehicles) {
      const def = VEHICLES[v.kind];
      if (v.driverId === null) {
        v.speedFrac = Math.max(0, v.speedFrac - dtMs / 1200);
        continue;
      }
      if (v.hp <= 0) continue;
      const driver = this.players.find((p) => p.id === v.driverId);
      if (!driver || !driver.alive) {
        v.driverId = null;
        v.speedFrac = 0;
        continue;
      }
      const throttle = driver.input.my;
      const steer = driver.input.mx;
      v.aim += steer * 2.2 * (dtMs / 1000) * (0.4 + v.speedFrac * 0.6);
      const accel = throttle !== 0 ? 1 : -0.5;
      v.speedFrac = clamp(v.speedFrac + accel * (dtMs / 1000), 0, 1);
      const speed = def.speed * PLAYER_SPEED * v.speedFrac * (throttle < 0 ? -0.5 : 1) * (dtMs / 1000);
      let nx = v.x + Math.cos(v.aim) * speed;
      let ny = v.y + Math.sin(v.aim) * speed;
      nx = clamp(nx, -WORLD_RADIUS + 30, WORLD_RADIUS - 30);
      ny = clamp(ny, -WORLD_RADIUS + 30, WORLD_RADIUS - 30);
      let blocked = false;
      for (const o of this.map.obstacles) {
        if (circleHitsObstacle(nx, ny, 24, [o])) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        v.speedFrac *= 0.4;
        v.hp -= 6;
      } else {
        v.x = nx;
        v.y = ny;
      }
      driver.x = v.x;
      driver.y = v.y;
      driver.aim = v.aim;

      if (v.speedFrac > 0.25 && this.timeMs - v.lastRunOverMs > 700) {
        for (const p of this.players) {
          if (!p.alive || p.id === v.driverId || p.landing) continue;
          if (dist(p, v) < 30) {
            const killer = this.players.find((k) => k.id === v.driverId) ?? null;
            this.applyDamage(p, runOverDamageAt(v.kind, v.speedFrac), killer);
            v.lastRunOverMs = this.timeMs;
            break;
          }
        }
      }
    }
    const broken = this.vehicles.filter((v) => v.hp <= 0);
    if (broken.length > 0) {
      for (const v of broken) {
        this.explodeAt(v.x, v.y, v.driverId ?? 0, 90, 140);
        if (v.driverId !== null) {
          const driver = this.players.find((p) => p.id === v.driverId);
          if (driver && driver.alive) {
            driver.x = v.x + 34;
            driver.y = v.y + 34;
            this.applyDamage(driver, 45, null);
          }
          v.driverId = null;
        }
        this.events.push({ kind: 'vehicle', x: v.x, y: v.y });
      }
      this.vehicles = this.vehicles.filter((v) => v.hp > 0);
    }
  }

  effectiveRadius(player: SimPlayer): number {
    if (player.prone) return PRONE_RADIUS;
    if (player.sliding) return SLIDE_RADIUS;
    return PLAYER_RADIUS;
  }

  abilityCooldownRemaining(playerId: number): number {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return 0;
    return Math.max(0, player.abilityReadyMs - this.timeMs);
  }

  useAbility(playerId: number): AbilityId | null {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.alive || this.phase !== 'play') return null;
    if (this.timeMs < player.abilityReadyMs) return null;
    const def = CHARACTERS[player.characterId];
    player.abilityReadyMs = this.timeMs + def.ability.cooldownMs;
    if (def.ability.durationMs > 0) player.abilityEndsAtMs = this.timeMs + def.ability.durationMs;
    switch (def.ability.id) {
      case 'muro':
        this.deployCoverWall(player);
        break;
      case 'sprint':
        break;
      case 'resistencia':
        break;
      case 'recarga': {
        const weapon = this.activeWeapon(player);
        if (weapon) {
          const wdef = WEAPONS[weapon.weaponId];
          const need = wdef.magSize - weapon.ammoInMag;
          const take = Math.min(need, player.inventory.ammo);
          weapon.ammoInMag += take;
          player.inventory.ammo -= take;
          player.reloadEndMs = -1;
        }
        break;
      }
      case 'pulso':
        player.hp = Math.min(MAX_HP, player.hp + 30);
        break;
      case 'sobrecarga':
        break;
    }
    this.events.push({
      kind: 'ability',
      playerId: player.id,
      abilityId: def.ability.id,
      x: player.x,
      y: player.y,
    });
    return def.ability.id;
  }

  private deployCoverWall(player: SimPlayer): void {
    const cx = player.x + Math.cos(player.aim) * COVER_WALL.deployDistance;
    const cy = player.y + Math.sin(player.aim) * COVER_WALL.deployDistance;
    const half = COVER_WALL.width / 2;
    const perpendicular = player.aim + Math.PI / 2;
    const dx = Math.cos(perpendicular) * half;
    const dy = Math.sin(perpendicular) * half;
    const x = Math.min(cx - Math.abs(dx), cx + Math.abs(dx));
    const y = Math.min(cy - Math.abs(dy), cy + Math.abs(dy));
    this.walls.push({
      id: this.nextWallId++,
      x,
      y,
      w: Math.abs(dx) * 2 || COVER_WALL.height,
      h: Math.abs(dy) * 2 || COVER_WALL.height,
      hp: COVER_WALL.hp,
      expiresAtMs: this.timeMs + COVER_WALL.durationMs,
      ownerId: player.id,
    });
  }

  private damageWall(wall: CoverWall, damage: number): void {
    wall.hp -= damage;
  }

  private activeWeapon(player: SimPlayer) {
    return player.inventory.weapons[player.inventory.activeWeapon] ?? null;
  }

  swapWeapon(playerId: number, slot: number): boolean {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.alive || this.phase !== 'play') return false;
    if (slot !== 0 && slot !== 1) return false;
    if (!player.inventory.weapons[slot]) return false;
    player.inventory.activeWeapon = slot;
    player.reloadEndMs = -1;
    return true;
  }

  reload(playerId: number): boolean {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.alive || this.phase !== 'play') return false;
    if (player.reloadEndMs > this.timeMs) return false;
    const weapon = this.activeWeapon(player);
    if (!weapon) return false;
    const def = WEAPONS[weapon.weaponId];
    if (weapon.ammoInMag >= def.magSize || player.inventory.ammo <= 0) return false;
    const reloadMult = CHARACTERS[player.characterId].passives.reloadMult;
    player.reloadEndMs = this.timeMs + def.reloadMs * reloadMult;
    return true;
  }

  useConsumable(playerId: number, consumable: ConsumableId): boolean {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.alive || this.phase !== 'play') return false;
    const pet = player.petId ? petEffective(player.petId, player.petLevel) : null;
    const healMult = CHARACTERS[player.characterId].passives.healMult * (pet?.healMult ?? 1);
    if (consumable === 'botiquin') {
      if (player.inventory.botiquines <= 0 || player.hp >= MAX_HP) return false;
      player.inventory.botiquines -= 1;
      player.hp = Math.min(MAX_HP, player.hp + 50 * healMult);
    } else {
      if (player.inventory.escudos <= 0 || player.shield >= MAX_SHIELD) return false;
      player.inventory.escudos -= 1;
      player.shield = Math.min(MAX_SHIELD, player.shield + 50);
    }
    return true;
  }

  pickup(playerId: number): GroundItem | null {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.alive || this.phase !== 'play') return null;
    let best: GroundItem | null = null;
    let bestD = PICKUP_RADIUS;
    for (const item of this.items) {
      const d = dist(player, item.pos);
      if (d < bestD) {
        bestD = d;
        best = item;
      }
    }
    if (!best) return null;
    if (!this.applyItem(player, best)) return null;
    this.items = this.items.filter((i) => i.id !== best!.id);
    this.events.push({
      kind: 'pickup',
      playerId: player.id,
      x: player.x,
      y: player.y,
    });
    return best;
  }

  private applyItem(player: SimPlayer, item: GroundItem): boolean {
    const inv = player.inventory;
    switch (item.kind) {
      case 'weapon': {
        const weaponId = item.weaponId!;
        const existing = inv.weapons.findIndex((w) => w === null);
        const slot = existing >= 0 ? existing : inv.activeWeapon;
        inv.weapons[slot] = { weaponId, rarity: item.rarity, ammoInMag: 0 };
        inv.activeWeapon = slot;
        return true;
      }
      case 'consumable': {
        if (item.consumableId === 'botiquin') {
          if (inv.botiquines >= 5) return false;
          inv.botiquines += 1;
        } else if (item.consumableId === 'escudo') {
          if (inv.escudos >= 5) return false;
          inv.escudos += 1;
        } else {
          if (player.inventory.grenades >= MAX_GRENADES) return false;
          player.inventory.grenades += 1;
        }
        return true;
      }
      case 'ammo': {
        const pet = player.petId ? petEffective(player.petId, player.petLevel) : null;
        inv.ammo += (item.amount ?? 24) + (pet?.ammoBonus ?? 0);
        return true;
      }
      case 'shieldcore': {
        if (player.shield >= MAX_SHIELD) return false;
        player.shield = Math.min(MAX_SHIELD, player.shield + (item.amount ?? 25));
        return true;
      }
    }
  }

  dropWeapon(playerId: number): boolean {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.alive || this.phase !== 'play') return false;
    const weapon = this.activeWeapon(player);
    if (!weapon) return false;
    this.items.push({
      id: 0,
      pos: { x: player.x, y: player.y },
      kind: 'weapon',
      weaponId: weapon.weaponId,
      rarity: weapon.rarity,
    });
    const idx = this.items.length - 1;
    this.items[idx]!.id = 900000 + this.items[idx]!.id;
    player.inventory.weapons[player.inventory.activeWeapon] = null;
    player.inventory.activeWeapon = player.inventory.weapons[0] ? 0 : 1;
    return true;
  }

  throwGrenade(playerId: number): boolean {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.alive || this.phase !== 'play') return false;
    if (player.inventory.grenades <= 0) return false;
    player.inventory.grenades -= 1;
    this.grenades.push({
      id: this.nextGrenadeId++,
      x: player.x + Math.cos(player.aim) * (PLAYER_RADIUS + 6),
      y: player.y + Math.sin(player.aim) * (PLAYER_RADIUS + 6),
      vx: Math.cos(player.aim) * GRENADE_SPEED,
      vy: Math.sin(player.aim) * GRENADE_SPEED,
      ownerId: player.id,
      fuseMs: GRENADE_FUSE_MS,
    });
    return true;
  }

  private explodeGrenade(g: Grenade): void {
    this.explodeAt(g.x, g.y, g.ownerId, GRENADE_DAMAGE, GRENADE_RADIUS);
  }

  private explodeAt(
    x: number,
    y: number,
    ownerId: number,
    damage: number,
    radius: number,
  ): void {
    this.events.push({ kind: 'explosion', x, y, playerId: ownerId });
    for (const p of this.players) {
      if (!p.alive || p.landing) continue;
      const d = dist(p, { x, y });
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      const killer = this.players.find((k) => k.id === ownerId) ?? null;
      this.applyDamage(p, damage * falloff, killer);
    }
    for (const wall of this.walls) {
      const cx = wall.x + wall.w / 2;
      const cy = wall.y + wall.h / 2;
      if (dist({ x: cx, y: cy }, { x, y }) <= radius) this.damageWall(wall, damage);
    }
  }

  private stepGrenades(dtMs: number): void {
    const dtSec = dtMs / 1000;
    const alive: Grenade[] = [];
    for (const g of this.grenades) {
      g.fuseMs -= dtMs;
      const friction = Math.max(0, 1 - dtSec * 2.2);
      g.vx *= friction;
      g.vy *= friction;
      let nx = g.x + g.vx * dtSec;
      let ny = g.y + g.vy * dtSec;
      if (
        circleHitsObstacle(nx, ny, 4, this.map.obstacles) ||
        this.walls.some((w) => circleHitsObstacle(nx, ny, 4, [w]))
      ) {
        g.vx *= -0.4;
        g.vy *= -0.4;
        nx = g.x;
        ny = g.y;
      }
      g.x = clamp(nx, -WORLD_RADIUS, WORLD_RADIUS);
      g.y = clamp(ny, -WORLD_RADIUS, WORLD_RADIUS);
      if (g.fuseMs <= 0) this.explodeGrenade(g);
      else alive.push(g);
    }
    this.grenades = alive;
  }

  private spawnAirdrop(): void {
    const angle = this.rng.next() * Math.PI * 2;
    const offset = this.rng.next() * this.zone.radius * 0.7;
    const x = clamp(this.zone.cx + Math.cos(angle) * offset, -WORLD_RADIUS + 60, WORLD_RADIUS - 60);
    const y = clamp(this.zone.cy + Math.sin(angle) * offset, -WORLD_RADIUS + 60, WORLD_RADIUS - 60);
    this.items.push({
      id: 0,
      pos: { x, y },
      kind: 'weapon',
      weaponId: this.rng.pick(['francotirador', 'ametralladora', 'fusil'] as const),
      rarity: 'legendario',
    });
    const idx = this.items.length - 1;
    this.items[idx]!.id = 900000 + this.items[idx]!.id;
    this.items.push({ id: 900001 + this.rng.int(1, 99999), pos: { x: x + 18, y }, kind: 'shieldcore', rarity: 'legendario', amount: 50 });
    this.items.push({ id: 900002 + this.rng.int(1, 99999), pos: { x: x - 18, y }, kind: 'ammo', rarity: 'comun', amount: 60 });
    this.events.push({ kind: 'airdrop', x, y });
  }

  private fireWeapon(player: SimPlayer, nowMs: number): void {
    const weapon = this.activeWeapon(player);
    if (!weapon) return;
    const def = WEAPONS[weapon.weaponId];
    if (nowMs - player.lastFireMs < def.fireIntervalMs) return;
    if (player.reloadEndMs > nowMs) return;
    if (weapon.ammoInMag <= 0) return;
    weapon.ammoInMag -= 1;
    player.lastFireMs = nowMs;
    player.firing = true;
    const passives = CHARACTERS[player.characterId].passives;
    const mult =
      RARITY_DAMAGE_MULT[weapon.rarity] *
      (this.isAbilityActive(player, 'sobrecarga') ? 1.3 : 1) *
      (this.mode.damageMult ?? 1);
    for (let i = 0; i < def.pellets; i++) {
      const spread = (this.rng.next() - 0.5) * 2 * def.spreadRad;
      const angle = player.aim + spread;
      this.bullets.push({
        id: this.nextBulletId++,
        x: player.x + Math.cos(angle) * (PLAYER_RADIUS + 4),
        y: player.y + Math.sin(angle) * (PLAYER_RADIUS + 4),
        vx: Math.cos(angle) * def.bulletSpeed,
        vy: Math.sin(angle) * def.bulletSpeed,
        ownerId: player.id,
        damage: def.damage * mult,
        traveled: 0,
        range: def.range * passives.rangeMult,
        explosive: def.explosive === true,
      });
    }
    this.events.push({ kind: 'shot', playerId: player.id, x: player.x, y: player.y, weaponId: weapon.weaponId });
  }

  private isAbilityActive(player: SimPlayer, ability: AbilityId): boolean {
    return (
      player.abilityEndsAtMs > this.timeMs &&
      CHARACTERS[player.characterId].ability.id === ability
    );
  }

  private killPlayer(victim: SimPlayer, killer: SimPlayer | null): void {
    victim.alive = false;
    victim.hp = 0;
    this.nextPlacement += 1;
    victim.placement = this.totalPlayers - this.nextPlacement + 1;
    if (killer && killer.id !== victim.id) killer.kills += 1;
    for (const w of victim.inventory.weapons) {
      if (w) {
        this.items.push({
          id: 0,
          pos: { x: victim.x + this.rng.range(-20, 20), y: victim.y + this.rng.range(-20, 20) },
          kind: 'weapon',
          weaponId: w.weaponId,
          rarity: w.rarity,
        });
        const idx = this.items.length - 1;
        this.items[idx]!.id = 900000 + this.items[idx]!.id;
      }
    }
    if (victim.inventory.ammo > 0) {
      this.items.push({
        id: 900000 + this.rng.int(1, 999999),
        pos: { x: victim.x + this.rng.range(-20, 20), y: victim.y + this.rng.range(-20, 20) },
        kind: 'ammo',
        rarity: 'comun',
        amount: Math.min(victim.inventory.ammo, 40),
      });
    }
    this.events.push({
      kind: 'kill',
      killerId: killer?.id,
      killerName: killer?.name,
      victimId: victim.id,
      victimName: victim.name,
    });
  }

  private applyDamage(victim: SimPlayer, damage: number, killer: SimPlayer | null): void {
    let remaining = damage;
    const resistance =
      CHARACTERS[victim.characterId].passives.resistance *
      (this.isAbilityActive(victim, 'resistencia') ? 0.5 : 1);
    remaining *= resistance;
    if (victim.shield > 0) {
      const absorbed = Math.min(victim.shield, remaining);
      victim.shield -= absorbed;
      remaining -= absorbed;
    }
    victim.hp -= remaining;
    this.events.push({
      kind: 'hit',
      victimId: victim.id,
      playerId: killer?.id,
      x: killer?.x,
      y: killer?.y,
    });
    if (victim.hp <= 0) this.killPlayer(victim, killer);
  }

  private movePlayer(player: SimPlayer, dtMs: number): void {
    if (!player.alive || player.landing) return;
    const vehicle = this.drivingVehicle(player);
    if (vehicle) {
      player.x = vehicle.x;
      player.y = vehicle.y;
      player.aim = vehicle.aim;
      return;
    }
    const passives = CHARACTERS[player.characterId].passives;
    const pet = player.petId ? petEffective(player.petId, player.petLevel) : null;
    const moving = player.input.mx !== 0 || player.input.my !== 0;
    player.prone = player.input.prone === true;
    if (player.input.slide === true && moving && this.timeMs >= player.nextSlideMs && !player.prone) {
      player.sliding = true;
      player.slideEndsAtMs = this.timeMs + SLIDE_DURATION_MS;
      player.nextSlideMs = this.timeMs + SLIDE_COOLDOWN_MS;
    }
    if (player.sliding && (this.timeMs >= player.slideEndsAtMs || !moving)) player.sliding = false;
    const stanceMult = player.prone ? PRONE_SPEED_MULT : player.sliding ? SLIDE_BOOST_MULT : 1;
    const speed =
      PLAYER_SPEED *
      passives.speedMult *
      (pet?.speedMult ?? 1) *
      (this.isAbilityActive(player, 'sprint') ? 1.55 : 1) *
      stanceMult *
      (TICK_MS / 1000) *
      (dtMs / TICK_MS);
    let nx = player.x + player.input.mx * speed;
    let ny = player.y + player.input.my * speed;
    nx = clamp(nx, -WORLD_RADIUS + PLAYER_RADIUS, WORLD_RADIUS - PLAYER_RADIUS);
    ny = clamp(ny, -WORLD_RADIUS + PLAYER_RADIUS, WORLD_RADIUS - PLAYER_RADIUS);
    for (const o of this.map.obstacles) {
      const resolved = resolveCircleRectCollision(nx, ny, o);
      nx = resolved.x;
      ny = resolved.y;
    }
    for (const wall of this.walls) {
      const resolved = resolveCircleRectCollision(nx, ny, wall);
      nx = resolved.x;
      ny = resolved.y;
    }
    player.x = nx;
    player.y = ny;
  }

  private stepBullets(dtMs: number): void {
    const dtSec = dtMs / 1000;
    const alive: Bullet[] = [];
    for (const b of this.bullets) {
      const nx = b.x + b.vx * dtSec;
      const ny = b.y + b.vy * dtSec;
      const stepLen = Math.hypot(nx - b.x, ny - b.y);
      let hit = false;

      for (const o of this.map.obstacles) {
        if (segmentHitsRect(b.x, b.y, nx, ny, o)) {
          hit = true;
          break;
        }
      }

      if (!hit) {
        for (const wall of this.walls) {
          if (segmentHitsRect(b.x, b.y, nx, ny, wall)) {
            this.damageWall(wall, b.damage);
            hit = true;
            break;
          }
        }
      }

      if (!hit) {
        for (const p of this.players) {
          if (!p.alive || p.id === b.ownerId || p.landing) continue;
          if (this.segmentHitsPlayer(b.x, b.y, nx, ny, p.x, p.y, this.effectiveRadius(p))) {
            const killer = this.players.find((k) => k.id === b.ownerId) ?? null;
            this.applyDamage(p, b.damage, killer);
            hit = true;
            break;
          }
        }
      }

      if (!hit) {
        for (const v of this.vehicles) {
          if (v.hp <= 0) continue;
          if (this.segmentHitsPlayer(b.x, b.y, nx, ny, v.x, v.y, 26)) {
            v.hp -= b.damage;
            hit = true;
            break;
          }
        }
      }

      if (hit && b.explosive) {
        this.explodeAt(b.x, b.y, b.ownerId, EXPLOSION_DAMAGE, EXPLOSION_RADIUS);
      }

      b.traveled += stepLen;
      if (!hit && b.traveled < b.range && Math.abs(nx) < WORLD_RADIUS && Math.abs(ny) < WORLD_RADIUS) {
        b.x = nx;
        b.y = ny;
        alive.push(b);
      }
    }
    this.bullets = alive;
  }

  private segmentHitsPlayer(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    r: number,
  ): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : clamp(((cx - ax) * dx + (cy - ay) * dy) / len2, 0, 1);
    const px = ax + dx * t;
    const py = ay + dy * t;
    return (px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r;
  }

  /** Zona roja: bombardeos aleatorios durante 10 s cada ~50 s. */
  private stepRedZone(dtMs: number): void {
    if (this.redZone) {
      this.redZoneBombMs -= dtMs;
      if (this.redZoneBombMs <= 0) {
        this.redZoneBombMs = 1500;
        const angle = this.rng.next() * Math.PI * 2;
        const dist = Math.sqrt(this.rng.next()) * this.redZone.r;
        this.explodeAt(
          this.redZone.x + Math.cos(angle) * dist,
          this.redZone.y + Math.sin(angle) * dist,
          0,
          90,
          140,
        );
      }
      if (this.timeMs >= this.redZone.untilMs) this.redZone = null;
      return;
    }
    if (this.timeMs >= this.redZoneNextMs) {
      this.redZoneNextMs = this.timeMs + 50_000;
      const angle = this.rng.next() * Math.PI * 2;
      const dist = this.rng.next() * WORLD_RADIUS * 0.6;
      this.redZone = {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        r: 260,
        untilMs: this.timeMs + 10_000,
      };
      this.redZoneBombMs = 500;
      this.events.push({ kind: 'zone', x: this.redZone.x, y: this.redZone.y });
    }
  }

  private checkVictory(): void {
    if (this.phase !== 'play') return;
    const alivePlayers = this.players.filter((p) => p.alive);
    if (alivePlayers.length <= 1) {
      this.phase = 'over';
      this.winnerId = alivePlayers[0]?.id ?? null;
      const winner = alivePlayers[0];
      if (winner) {
        this.nextPlacement += 1;
        winner.placement = 1;
      }
    }
  }

  tick(dtMs: number): SimEvent[] {
    this.events = [];
    this.timeMs += dtMs;
    this.tickCount += 1;

    if (this.walls.length > 0) {
      this.walls = this.walls.filter((w) => w.expiresAtMs > this.timeMs && w.hp > 0);
    }
    for (const p of this.players) {
      if (p.abilityEndsAtMs > 0 && this.timeMs >= p.abilityEndsAtMs) p.abilityEndsAtMs = -1;
    }

    if (this.phase === 'drop') {
      const allChosen = this.players.every((p) => p.dropChoice !== null);
      if (this.timeMs >= this.dropEndsAtMs || allChosen) {
        for (const p of this.players) this.landPlayer(p);
        this.phase = 'play';
      }
    }

    if (this.phase === 'play') {
      for (const p of this.players) {
        p.firing = false;
        if (!p.alive) continue;
        this.movePlayer(p, dtMs);
        if (p.input.fire) this.fireWeapon(p, this.timeMs);
        if (p.reloadEndMs > 0 && this.timeMs >= p.reloadEndMs) {
          const weapon = this.activeWeapon(p);
          if (weapon) {
            const def = WEAPONS[weapon.weaponId];
            const need = def.magSize - weapon.ammoInMag;
            const take = Math.min(need, p.inventory.ammo);
            weapon.ammoInMag += take;
            p.inventory.ammo -= take;
          }
          p.reloadEndMs = -1;
        }
      }

      this.stepBullets(dtMs);
      this.stepGrenades(dtMs);
      this.stepVehicles(dtMs);

      this.airdropTimerMs -= dtMs;
      if (this.airdropTimerMs <= 0) {
        this.airdropTimerMs = 45_000;
        this.spawnAirdrop();
      }

      this.stepRedZone(dtMs);

      updateZone(this.zone, dtMs * this.mode.zoneSpeedMult, this.rng);
      const dps = zoneDps(this.zone);
      for (const p of this.players) {
        if (!p.alive) continue;
        if (isOutsideZone(p.x, p.y, this.zone)) {
          const dmg = (dps * dtMs) / 1000;
          p.hp -= dmg;
          if (p.hp <= 0) this.killPlayer(p, null);
        }
      }

      this.checkVictory();
    }

    return this.events;
  }

  aliveCount(): number {
    return this.players.filter((p) => p.alive).length;
  }

  placementOf(playerId: number): number {
    const p = this.players.find((pl) => pl.id === playerId);
    if (!p) return 0;
    if (p.alive && this.phase === 'over' && this.winnerId === playerId) return 1;
    return p.placement || 1;
  }
}
