import { PLAYER_RADIUS, WORLD_RADIUS, dist } from './constants.js';
import { segmentHitsRect } from './map.js';
import type { MatchSim, SimPlayer } from './sim.js';
import { isOutsideZone } from './zone.js';

export interface BotBrain {
  wanderTarget: { x: number; y: number } | null;
  nextDecisionMs: number;
  strafeDir: number;
  reactionDelayMs: number;
}

const hasLineOfSight = (sim: MatchSim, a: SimPlayer, b: SimPlayer): boolean => {
  for (const o of sim.map.obstacles) {
    if (segmentHitsRect(a.x, a.y, b.x, b.y, o)) return false;
  }
  return true;
};

export const updateBot = (sim: MatchSim, bot: SimPlayer, brain: BotBrain, dtMs: number): void => {
  if (!bot.alive || sim.phase !== 'play') {
    bot.input = { mx: 0, my: 0, aim: 0, fire: false, seq: bot.input.seq };
    return;
  }

  const target = sim.players.find(
    (p) =>
      p.alive &&
      p.id !== bot.id &&
      !p.landing &&
      dist(p, bot) < 340 &&
      hasLineOfSight(sim, bot, p),
  );

  const outside = isOutsideZone(bot.x, bot.y, sim.zone);

  if (target) {
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const d = Math.hypot(dx, dy) || 1;
    bot.aim = Math.atan2(dy, dx);
    const desired = d > 160 ? 1 : d < 90 ? -0.6 : 0;
    const strafe = Math.sin(sim.timeMs / 400 + bot.id) * brain.strafeDir;
    bot.input = {
      mx: (dx / d) * desired + (-dy / d) * strafe,
      my: (dy / d) * desired + (dx / d) * strafe,
      aim: bot.aim,
      fire: true,
      seq: bot.input.seq,
    };
    if (bot.inventory.weapons.every((w) => w === null)) {
      sim.pickup(bot.id);
    }
    return;
  }

  if (outside) {
    const dx = sim.zone.cx - bot.x;
    const dy = sim.zone.cy - bot.y;
    const d = Math.hypot(dx, dy) || 1;
    bot.input = { mx: dx / d, my: dy / d, aim: Math.atan2(dy, dx), fire: false, seq: bot.input.seq };
    return;
  }

  if (sim.timeMs >= brain.nextDecisionMs || !brain.wanderTarget) {
    brain.nextDecisionMs = sim.timeMs + 1500 + Math.random() * 2500;
    const loot = sim.items
      .filter((i) => dist(i.pos, bot) < 500)
      .sort((a, b) => dist(a.pos, bot) - dist(b.pos, bot))[0];
    if (loot && Math.random() < 0.7) {
      brain.wanderTarget = { ...loot.pos };
    } else {
      brain.wanderTarget = {
        x: sim.zone.cx + (Math.random() - 0.5) * sim.zone.radius,
        y: sim.zone.cy + (Math.random() - 0.5) * sim.zone.radius,
      };
    }
  }

  const wt = brain.wanderTarget!;
  const dx = wt.x - bot.x;
  const dy = wt.y - bot.y;
  const d = Math.hypot(dx, dy);
  if (d < 30) {
    brain.wanderTarget = null;
    bot.input = { mx: 0, my: 0, aim: bot.aim, fire: false, seq: bot.input.seq };
  } else {
    bot.input = { mx: dx / d, my: dy / d, aim: Math.atan2(dy, dx), fire: false, seq: bot.input.seq };
  }

  if (bot.hp < 60 && bot.inventory.botiquines > 0) sim.useConsumable(bot.id, 'botiquin');
  if (bot.shield < 40 && bot.inventory.escudos > 0) sim.useConsumable(bot.id, 'escudo');

  const weapon = bot.inventory.weapons[bot.inventory.activeWeapon];
  if (weapon && weapon.ammoInMag === 0) sim.reload(bot.id);

  const nearItem = sim.items.find((i) => dist(i.pos, bot) < 60);
  if (nearItem) sim.pickup(bot.id);

  void dtMs;
  void WORLD_RADIUS;
  void PLAYER_RADIUS;
};
