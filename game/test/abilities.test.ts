import { describe, expect, it } from 'vitest';
import { MatchSim, type SimPlayer } from '../src/shared/sim.js';
import { updateBot, type BotBrain } from '../src/shared/bots.js';
import { CHARACTERS, CHARACTER_IDS, COVER_WALL, isCharacterId } from '../src/shared/characters.js';

const makeSim = (botCount = 0) => {
  const sim = new MatchSim({ seed: 4242, botCount, dropPhaseMs: 1000 });
  sim.startDrop();
  return sim;
};

const enterPlay = (sim: MatchSim, humans: SimPlayer[]): void => {
  const filler = sim.addPlayer('filler', true);
  for (const h of [...humans, filler]) sim.chooseDrop(h.id, 0, 0);
  sim.tick(33);
  expect(sim.phase).toBe('play');
};

describe('Personajes y habilidades', () => {
  it('existen 9 personajes con rol, habilidad activa y pasivas', () => {
    expect(CHARACTER_IDS.length).toBe(9);
    const roles = new Set(CHARACTER_IDS.map((id) => CHARACTERS[id]!.role));
    for (const id of CHARACTER_IDS) {
      const def = CHARACTERS[id]!;
      expect(def.ability.cooldownMs).toBeGreaterThan(0);
      expect(def.passives.speedMult).toBeGreaterThan(0);
      expect(['atacante', 'apoyo', 'explorador', 'defensor', 'sigilo', 'francotirador']).toContain(def.role);
    }
    expect(roles.size).toBe(6);
  });

  it('valida characterId de forma segura', () => {
    expect(isCharacterId('aurora')).toBe(true);
    expect(isCharacterId('inexistente')).toBe(false);
    expect(isCharacterId(42)).toBe(false);
  });

  it('la habilidad respeta su cooldown', () => {
    const sim = makeSim();
    const p = sim.addPlayer('h', false, 'sombra');
    enterPlay(sim, [p]);
    expect(sim.useAbility(p.id)).toBe('sprint');
    expect(sim.useAbility(p.id)).toBeNull();
    expect(sim.abilityCooldownRemaining(p.id)).toBeGreaterThan(0);
    for (let i = 0; i < 400; i++) sim.tick(33);
    expect(sim.abilityCooldownRemaining(p.id)).toBe(0);
    expect(sim.useAbility(p.id)).toBe('sprint');
  });

  it('sprint aumenta la velocidad de movimiento', () => {
    const sim = makeSim();
    const p = sim.addPlayer('h', false, 'sombra');
    enterPlay(sim, [p]);
    p.input = { mx: 1, my: 0, aim: 0, fire: false, seq: 1 };
    const x0 = p.x;
    sim.tick(33);
    const normalDist = p.x - x0;
    p.x = 0;
    p.y = 0;
    sim.useAbility(p.id);
    const x1 = p.x;
    sim.tick(33);
    const sprintDist = p.x - x1;
    expect(sprintDist).toBeGreaterThan(normalDist * 1.3);
  });

  it('pulso sanador cura 30 de vida', () => {
    const sim = makeSim();
    const p = sim.addPlayer('h', false, 'vita');
    enterPlay(sim, [p]);
    p.hp = 40;
    expect(sim.useAbility(p.id)).toBe('pulso');
    expect(p.hp).toBe(70);
  });

  it('recarga táctica llena el cargador al instante', () => {
    const sim = makeSim();
    const p = sim.addPlayer('h', false, 'halcon');
    enterPlay(sim, [p]);
    p.inventory.ammo = 60;
    const pickup = sim.items.find((i) => i.kind === 'weapon');
    expect(pickup).toBeDefined();
    p.x = pickup!.pos.x;
    p.y = pickup!.pos.y;
    expect(sim.pickup(p.id)).not.toBeNull();
    const weapon = p.inventory.weapons[p.inventory.activeWeapon]!;
    weapon.ammoInMag = 0;
    expect(sim.useAbility(p.id)).toBe('recarga');
    expect(weapon.ammoInMag).toBeGreaterThan(0);
  });

  it('resistencia reduce el daño recibido a la mitad durante la habilidad', () => {
    const sim = makeSim();
    const p = sim.addPlayer('h', false, 'titan');
    const filler = sim.addPlayer('filler', true);
    enterPlay(sim, [p, filler]);
    sim.useAbility(p.id);
    const hp0 = p.hp;
    sim.map.obstacles.length = 0;
    filler.x = p.x + 200;
    filler.y = p.y;
    filler.aim = Math.PI;
    filler.inventory.weapons[0] = { weaponId: 'francotirador', rarity: 'comun', ammoInMag: 5 };
    filler.inventory.activeWeapon = 0;
    filler.input = { mx: 0, my: 0, aim: Math.PI, fire: true, seq: 1 };
    for (let i = 0; i < 30; i++) sim.tick(33);
    const lost = hp0 - p.hp;
    expect(lost).toBeGreaterThan(0);
    expect(lost).toBeLessThan(70 * 0.9);
  });

  it('Aurora despliega el Muro de Cuarzo que bloquea balas y expira', () => {
    const sim = makeSim();
    const shooter = sim.addPlayer('shooter', false, 'vulcano');
    const target = sim.addPlayer('target', false, 'aurora');
    enterPlay(sim, [shooter, target]);
    target.aim = 0;
    expect(sim.useAbility(target.id)).toBe('muro');
    expect(sim.walls.length).toBe(1);
    const wall = sim.walls[0]!;
    expect(wall.hp).toBe(COVER_WALL.hp);

    shooter.x = wall.x - 200;
    shooter.y = wall.y + wall.h / 2 + 40;
    target.x = wall.x + 200;
    target.y = wall.y + wall.h / 2 + 40;
    shooter.aim = 0;
    shooter.inventory.weapons[0] = { weaponId: 'fusil', rarity: 'comun', ammoInMag: 25 };
    shooter.inventory.activeWeapon = 0;
    const hp0 = target.hp;
    shooter.input = { mx: 0, my: 0, aim: 0, fire: true, seq: 1 };
    for (let i = 0; i < 40; i++) sim.tick(33);
    expect(target.hp).toBe(hp0);
    expect(wall.hp).toBeLessThan(COVER_WALL.hp);

    for (let i = 0; i < 400; i++) sim.tick(33);
    expect(sim.walls.length).toBe(0);
  });

  it('el muro bloquea también a los bots (colisión de movimiento)', () => {
    const sim = makeSim();
    const p = sim.addPlayer('h', false, 'aurora');
    enterPlay(sim, [p]);
    p.aim = 0;
    sim.useAbility(p.id);
    const wall = sim.walls[0]!;
    p.x = wall.x - 60;
    p.y = wall.y + wall.h / 2;
    p.input = { mx: 1, my: 0, aim: 0, fire: false, seq: 1 };
    for (let i = 0; i < 30; i++) sim.tick(33);
    expect(p.x).toBeLessThan(wall.x + wall.w + 15);
  });

  it('slide da impulso temporal con cooldown', () => {
    const sim = makeSim();
    const p = sim.addPlayer('h', false, 'titan');
    enterPlay(sim, [p]);
    p.input = { mx: 1, my: 0, aim: 0, fire: false, seq: 1, slide: true };
    sim.tick(33);
    expect(p.sliding).toBe(true);
    p.input = { mx: 1, my: 0, aim: 0, fire: false, seq: 2, slide: false };
    for (let i = 0; i < 25; i++) sim.tick(33);
    expect(p.sliding).toBe(false);
    p.input = { mx: 1, my: 0, aim: 0, fire: false, seq: 3, slide: true };
    sim.tick(33);
    expect(p.sliding).toBe(false);
    p.input = { mx: 1, my: 0, aim: 0, fire: false, seq: 4, slide: false };
    for (let i = 0; i < 70; i++) sim.tick(33);
    p.input = { mx: 1, my: 0, aim: 0, fire: false, seq: 5, slide: true };
    sim.tick(33);
    expect(p.sliding).toBe(true);
  });

  it('prone reduce la velocidad y el perfil', () => {
    const sim = makeSim();
    const p = sim.addPlayer('h', false, 'titan');
    enterPlay(sim, [p]);
    p.input = { mx: 1, my: 0, aim: 0, fire: false, seq: 1 };
    const x0 = p.x;
    sim.tick(33);
    const standDist = p.x - x0;
    p.input = { mx: 1, my: 0, aim: 0, fire: false, seq: 2, prone: true };
    const x1 = p.x;
    sim.tick(33);
    const proneDist = p.x - x1;
    expect(proneDist).toBeLessThan(standDist * 0.6);
    expect(p.prone).toBe(true);
    expect(sim.effectiveRadius(p)).toBeLessThan(14);
  });

  it('los bots también usan su habilidad', () => {
    const sim = new MatchSim({ seed: 99, botCount: 5, dropPhaseMs: 1000 });
    sim.startDrop();
    sim.tick(1100);
    expect(sim.phase).toBe('play');
    const used = new Set(
      sim.players.map((p) => p.characterId),
    );
    expect(used.size).toBeGreaterThan(1);
    sim.map.obstacles.length = 0;
    const [a, b] = sim.players.filter((p) => p.alive);
    b.x = a.x + 60;
    b.y = a.y;
    const brains = new Map<number, BotBrain>();
    for (const bot of sim.players) {
      brains.set(bot.id, {
        wanderTarget: null,
        nextDecisionMs: 0,
        strafeDir: 1,
        reactionDelayMs: 100,
        grenadeReadyMs: 0,
        abilityReadyMs: 0,
      });
    }
    for (let i = 0; i < 120; i++) {
      for (const bot of sim.players) updateBot(sim, bot, brains.get(bot.id)!, 33);
      sim.tick(33);
    }
    expect(sim.players.some((p) => p.abilityReadyMs > 0)).toBe(true);
  });
});
