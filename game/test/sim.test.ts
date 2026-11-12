import { describe, expect, it } from 'vitest';
import { MatchSim, type SimPlayer } from '../src/shared/sim.js';
import { MAX_HP, MAX_SHIELD } from '../src/shared/constants.js';
import { isOutsideZone } from '../src/shared/zone.js';

const makeSim = (botCount = 0) => {
  const sim = new MatchSim({ seed: 12345, botCount, dropPhaseMs: 1000 });
  sim.startDrop();
  return sim;
};

const enterPlay = (sim: MatchSim, humans: SimPlayer[]): SimPlayer => {
  const filler = sim.addPlayer('filler', true);
  for (const h of [...humans, filler]) sim.chooseDrop(h.id, 0, 0);
  sim.tick(33);
  expect(sim.phase).toBe('play');
  return filler;
};

describe('MatchSim', () => {
  it('genera mapa con POIs, obstáculos y loot', () => {
    const sim = makeSim();
    expect(sim.map.pois.length).toBe(8);
    expect(sim.map.obstacles.length).toBeGreaterThan(10);
    expect(sim.items.length).toBeGreaterThan(20);
  });

  it('es determinista con la misma semilla', () => {
    const a = new MatchSim({ seed: 777, botCount: 3, dropPhaseMs: 1000 });
    const b = new MatchSim({ seed: 777, botCount: 3, dropPhaseMs: 1000 });
    a.startDrop();
    b.startDrop();
    for (let i = 0; i < 200; i++) {
      a.tick(33.33);
      b.tick(33.33);
    }
    expect(a.players.map((p) => [p.x, p.y])).toEqual(b.players.map((p) => [p.x, p.y]));
    expect(a.items.length).toBe(b.items.length);
  });

  it('pasa de lobby a drop a play', () => {
    const sim = makeSim();
    expect(sim.phase).toBe('drop');
    const human = sim.addPlayer(' Tester ', false);
    expect(human.name).toBe('Tester');
    const filler = sim.addPlayer('filler', true);
    sim.chooseDrop(human.id, 100, 100);
    sim.chooseDrop(filler.id, -300, 200);
    sim.tick(33);
    expect(sim.phase).toBe('play');
    expect(human.landing).toBe(false);
  });

  it('si nadie elige, el despliegue termina por tiempo', () => {
    const sim = makeSim();
    const human = sim.addPlayer('t', false);
    sim.addPlayer('filler', true);
    sim.tick(1100);
    expect(sim.phase).toBe('play');
    expect(human.landing).toBe(false);
  });

  it('aplica daño de zona fuera del círculo y mata por zona', () => {
    const sim = makeSim();
    const human = sim.addPlayer('z', false);
    const filler = enterPlay(sim, [human]);
    sim.zone.radius = 100;
    human.hp = 5;
    human.shield = 0;
    human.x = sim.zone.cx + 150;
    human.y = sim.zone.cy;
    filler.hp = 5;
    filler.shield = 0;
    filler.x = sim.zone.cx + 250;
    filler.y = sim.zone.cy;
    for (let i = 0; i < 600; i++) {
      sim.tick(33.33);
    }
    expect(human.alive).toBe(false);
    expect(filler.alive).toBe(false);
    expect(sim.phase).toBe('over');
  });

  it('la zona se encoge en fases legibles', () => {
    const sim = makeSim();
    const a = sim.addPlayer('a', false);
    const b = sim.addPlayer('b', false);
    enterPlay(sim, [a, b]);
    const r0 = sim.zone.radius;
    for (let i = 0; i < 2000; i++) sim.tick(33.33);
    expect(sim.zone.radius).toBeLessThan(r0);
    expect(sim.zone.mode === 'closed' || sim.zone.phase > 0).toBe(true);
  });

  it('dispara, pega y mata: victoria por último en pie', () => {
    const sim = makeSim();
    const a = sim.addPlayer('a', false);
    const b = sim.addPlayer('b', false);
    sim.tick(100);
    sim.chooseDrop(a.id, -500, 0);
    sim.chooseDrop(b.id, -480, 0);
    sim.tick(33);

    a.inventory.weapons[0] = { weaponId: 'fusil', rarity: 'comun', ammoInMag: 25 };
    a.inventory.activeWeapon = 0;
    a.aim = 0;
    b.hp = 1;
    b.shield = 0;

    a.input = { mx: 0, my: 0, aim: 0, fire: true, seq: 1 };
    const events: ReturnType<MatchSim['tick']> = [];
    for (let i = 0; i < 120; i++) {
      events.push(...sim.tick(33.33));
    }
    expect(b.alive).toBe(false);
    expect(a.kills).toBe(1);
    expect(events.some((e) => e.kind === 'kill')).toBe(true);
    expect(sim.phase).toBe('over');
    expect(sim.winnerId).toBe(a.id);
    expect(sim.placementOf(a.id)).toBe(1);
    expect(sim.placementOf(b.id)).toBe(2);
  });

  it('los escudos absorben daño antes que la vida', () => {
    const sim = makeSim();
    const a = sim.addPlayer('a', false);
    const b = sim.addPlayer('b', false);
    sim.tick(100);
    sim.chooseDrop(a.id, -500, 0);
    sim.chooseDrop(b.id, -480, 0);
    sim.tick(33);
    b.shield = 30;
    b.hp = MAX_HP;
    a.inventory.weapons[0] = { weaponId: 'francotirador', rarity: 'comun', ammoInMag: 5 };
    a.inventory.activeWeapon = 0;
    a.aim = 0;
    a.input = { mx: 0, my: 0, aim: 0, fire: true, seq: 1 };
    sim.tick(33.33);
    sim.tick(33.33);
    a.input = { mx: 0, my: 0, aim: 0, fire: false, seq: 2 };
    for (let i = 0; i < 10; i++) sim.tick(33.33);
    expect(b.shield).toBe(0);
    expect(b.hp).toBeLessThan(MAX_HP);
    expect(b.hp).toBeGreaterThan(0);
    expect(b.alive).toBe(true);
  });

  it('recoger arma y consumibles funciona y respeta límites', () => {
    const sim = makeSim();
    const p = sim.addPlayer('p', false);
    enterPlay(sim, [p]);
    p.x = 0;
    p.y = 0;
    sim.items.push({
      id: 1,
      pos: { x: 5, y: 0 },
      kind: 'weapon',
      weaponId: 'escopeta',
      rarity: 'epico',
    });
    const item = sim.pickup(p.id);
    expect(item?.kind).toBe('weapon');
    expect(p.inventory.weapons[0]?.weaponId).toBe('escopeta');
    expect(p.inventory.weapons[0]?.rarity).toBe('epico');

    sim.items.push({ id: 2, pos: { x: 5, y: 0 }, kind: 'consumable', consumableId: 'botiquin', rarity: 'comun', amount: 1 });
    sim.pickup(p.id);
    expect(p.inventory.botiquines).toBe(1);
    p.hp = 50;
    expect(sim.useConsumable(p.id, 'botiquin')).toBe(true);
    expect(p.hp).toBe(100);
    expect(sim.useConsumable(p.id, 'botiquin')).toBe(false);
  });

  it('usa núcleo de escudo respetando el máximo', () => {
    const sim = makeSim();
    const p = sim.addPlayer('p', false);
    enterPlay(sim, [p]);
    p.x = 0;
    p.y = 0;
    p.shield = 90;
    sim.items.push({ id: 3, pos: { x: 0, y: 0 }, kind: 'shieldcore', rarity: 'raro', amount: 25 });
    sim.pickup(p.id);
    expect(p.shield).toBe(MAX_SHIELD);
  });

  it('recarga con tiempo de recarga y munición limitada', () => {
    const sim = makeSim();
    const p = sim.addPlayer('p', false);
    enterPlay(sim, [p]);
    p.inventory.weapons[0] = { weaponId: 'pistola', rarity: 'comun', ammoInMag: 0 };
    p.inventory.activeWeapon = 0;
    p.inventory.ammo = 5;
    expect(sim.reload(p.id)).toBe(true);
    for (let i = 0; i < 60; i++) sim.tick(33.33);
    expect(p.inventory.weapons[0]?.ammoInMag).toBe(5);
    expect(p.inventory.ammo).toBe(0);
  });

  it('colisiona con obstáculos y límites del mapa', () => {
    const sim = makeSim();
    const p = sim.addPlayer('p', false);
    enterPlay(sim, [p]);
    const obstacle = sim.map.obstacles[0]!;
    p.x = obstacle.x - 10;
    p.y = obstacle.y + obstacle.h / 2;
    p.input = { mx: 1, my: 0, aim: 0, fire: false, seq: 1 };
    for (let i = 0; i < 60; i++) sim.tick(33.33);
    const inside =
      p.x + 14 > obstacle.x &&
      p.x - 14 < obstacle.x + obstacle.w &&
      p.y + 14 > obstacle.y &&
      p.y - 14 < obstacle.y + obstacle.h;
    expect(inside).toBe(false);
  });

  it('el daño fuera de zona usa dps de la fase actual', () => {
    const sim = makeSim();
    const p = sim.addPlayer('p', false);
    enterPlay(sim, [p]);
    p.hp = 100;
    p.shield = 0;
    sim.zone.radius = 100;
    p.x = sim.zone.cx + 150;
    p.y = sim.zone.cy;
    expect(isOutsideZone(p.x, p.y, sim.zone)).toBe(true);
    const hpBefore = p.hp;
    sim.tick(1000);
    expect(p.hp).toBeLessThan(hpBefore);
  });
});
