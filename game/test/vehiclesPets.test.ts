import { describe, expect, it } from 'vitest';
import { MatchSim } from '../src/shared/sim.js';
import { VEHICLES, VEHICLE_IDS, isVehicleId, runOverDamageAt, vehicleSpawnsForMap } from '../src/shared/vehicles.js';
import { PETS, PET_IDS, isPetId, petLevelFromMatches, petEffective, PET_MAX_LEVEL } from '../src/shared/pets.js';
import {
  spinRouletteWithPity,
  emptyPity,
  pityGuarantee,
  updatePity,
  PITY_EPIC_SPINS,
  PITY_LEGENDARY_SPINS,
  ROULETTE_POOL,
} from '../src/shared/roulette.js';
import { WORLD_RADIUS } from '../src/shared/constants.js';

describe('vehículos', () => {
  it('define 5 vehículos con estadísticas coherentes', () => {
    expect(VEHICLE_IDS).toHaveLength(5);
    for (const id of VEHICLE_IDS) {
      const v = VEHICLES[id];
      expect(v.speed).toBeGreaterThan(1);
      expect(v.hp).toBeGreaterThan(0);
      expect(v.seats).toBeGreaterThanOrEqual(1);
      expect(v.runOverDamage).toBeGreaterThan(0);
    }
    expect(VEHICLES.blindado.hp).toBeGreaterThan(VEHICLES.moto.hp);
    expect(VEHICLES.moto.speed).toBeGreaterThan(VEHICLES.blindado.speed);
    expect(VEHICLES.bote.aquatic).toBe(true);
  });

  it('el daño de atropello escala con la velocidad', () => {
    expect(runOverDamageAt('moto', 0)).toBeLessThan(runOverDamageAt('moto', 1));
    expect(runOverDamageAt('blindado', 1)).toBe(VEHICLES.blindado.runOverDamage);
  });

  it('aparecen vehículos deterministas por mapa, incluidos botes', () => {
    const a = vehicleSpawnsForMap('nexo-urbano', WORLD_RADIUS);
    const b = vehicleSpawnsForMap('nexo-urbano', WORLD_RADIUS);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(7);
    expect(a.filter((s) => s.id === 'bote')).toHaveLength(2);
    for (const s of a) {
      expect(isVehicleId(s.id)).toBe(true);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(WORLD_RADIUS);
    }
  });

  it('la simulación genera vehículos y permite subir y bajarse', () => {
    const sim = new MatchSim({ seed: 11, botCount: 6, dropPhaseMs: 0 });
    expect(sim.vehicles.length).toBeGreaterThanOrEqual(7);
    sim.startDrop();
    for (let i = 0; i < 5; i++) sim.tick(100);
    const player = sim.addPlayer('Yo', false);
    const near = sim.vehicles[0]!;
    player.x = near.x + 10;
    player.y = near.y + 10;
    expect(sim.toggleVehicle(player.id)).toBe(true);
    expect(sim.vehicleOf(player.id)?.id).toBe(near.id);
    expect(sim.toggleVehicle(player.id)).toBe(true);
    expect(sim.vehicleOf(player.id)).toBeNull();
  });

  it('conducir mueve al jugador con el vehículo', () => {
    const sim = new MatchSim({ seed: 12, botCount: 6, dropPhaseMs: 0 });
    sim.startDrop();
    for (let i = 0; i < 5; i++) sim.tick(100);
    const player = sim.addPlayer('Yo', false);
    const near = sim.vehicles[0]!;
    player.x = near.x;
    player.y = near.y;
    sim.toggleVehicle(player.id);
    player.input = { mx: 0, my: 1, aim: 0, fire: false, seq: 1 };
    const before = { x: near.x, y: near.y };
    for (let i = 0; i < 30; i++) sim.tick(100);
    expect(Math.hypot(near.x - before.x, near.y - before.y)).toBeGreaterThan(40);
    const stillDriving = sim.vehicleOf(player.id);
    if (stillDriving) expect(player.x).toBe(near.x);
  });

  it('las balas dañan el vehículo y al llegar a 0 explota y desaparece', () => {
    const sim = new MatchSim({ seed: 13, botCount: 6, dropPhaseMs: 0 });
    sim.startDrop();
    for (let i = 0; i < 5; i++) sim.tick(100);
    const player = sim.addPlayer('Yo', false);
    const near = sim.vehicles[0]!;
    player.x = near.x;
    player.y = near.y;
    sim.toggleVehicle(player.id);
    near.hp = 5;
    player.input = { mx: 0, my: 0, aim: 0, fire: false, seq: 1 };
    const other = sim.vehicles[1]!;
    player.x = other.x + 200;
    player.y = other.y;
    other.driverId = null;
    near.hp = 1;
    const v = sim.vehicles.find((x) => x.id === near.id)!;
    v.hp = 0;
    const events = sim.tick(100);
    expect(events.some((e) => e.kind === 'vehicle')).toBe(true);
    expect(sim.vehicles.find((x) => x.id === near.id)).toBeUndefined();
  });
});

describe('mascotas', () => {
  it('define 6 mascotas con bonos pequeños', () => {
    expect(PET_IDS).toHaveLength(6);
    for (const id of PET_IDS) {
      const p = PETS[id];
      expect(p.healMult).toBeGreaterThanOrEqual(1);
      expect(p.healMult).toBeLessThanOrEqual(1.25);
      expect(p.speedMult).toBeLessThanOrEqual(1.06);
    }
  });

  it('el nivel sube con partidas y mejora el bono sin pasarse del tope', () => {
    expect(petLevelFromMatches(0)).toBe(1);
    expect(petLevelFromMatches(90)).toBe(PET_MAX_LEVEL);
    const base = petEffective('cachorro', 1);
    const max = petEffective('cachorro', PET_MAX_LEVEL);
    expect(max.healMult).toBeGreaterThan(base.healMult);
    expect(max.healMult).toBeLessThan(1.35);
  });

  it('isPetId rechaza desconocidos', () => {
    expect(isPetId('dragon')).toBe(true);
    expect(isPetId('unicornio')).toBe(false);
  });

  it('la simulación aplica la mascota al jugador humano', () => {
    const sim = new MatchSim({ seed: 14, botCount: 6, dropPhaseMs: 0, petId: 'dragon', petLevel: 10 });
    const human = sim.addPlayer('Yo', false);
    const bot = sim.players.find((p) => p.bot)!;
    expect(human.petId).toBe('dragon');
    expect(bot.petId).toBeNull();
  });
});

describe('ruleta con pity', () => {
  it('garantiza épico tras el límite y legendario tras el suyo', () => {
    expect(pityGuarantee(emptyPity())).toBeNull();
    expect(pityGuarantee({ sinceEpic: PITY_EPIC_SPINS - 1, sinceLegendary: 0 })).toBe('epico');
    expect(pityGuarantee({ sinceEpic: 0, sinceLegendary: PITY_LEGENDARY_SPINS - 1 })).toBe('legendario');
  });

  it('el giro garantizado devuelve un premio de la rareza asegurada y resetea el contador', () => {
    const pity = { sinceEpic: PITY_EPIC_SPINS - 1, sinceLegendary: 0 };
    const { prize, pity: next, guaranteed } = spinRouletteWithPity(pity);
    expect(guaranteed).toBe(true);
    expect(prize.rarity).toBe('epico');
    expect(next.sinceEpic).toBe(0);
  });

  it('los giros normales incrementan los contadores', () => {
    const pity = updatePity(emptyPity(), ROULETTE_POOL[0]!);
    expect(pity.sinceEpic).toBe(1);
    const pity2 = updatePity(pity, ROULETTE_POOL[5]!);
    expect(pity2.sinceEpic).toBe(0);
  });
});
