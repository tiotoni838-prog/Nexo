/**
 * Misiones diarias y semanales + logros + recompensas de login diario.
 * Lógica pura e isomórfica: el servidor puede validar el progreso y el
 * cliente lo muestra. El progreso se alimenta de estadísticas de partida.
 */

export interface MissionDef {
  id: string;
  kind: 'kills' | 'wins' | 'matches' | 'top5' | 'grenadeKills' | 'abilityUses';
  target: number;
  reward: { nx?: number; dalos?: number; xp?: number };
  descEs: string;
  descEn: string;
}

export interface MatchStatsDelta {
  kills: number;
  wins: number;
  matches: number;
  top5: number;
  grenadeKills: number;
  abilityUses: number;
}

export const emptyStatsDelta = (): MatchStatsDelta => ({
  kills: 0,
  wins: 0,
  matches: 0,
  top5: 0,
  grenadeKills: 0,
  abilityUses: 0,
});

export const addStatsDelta = (a: MatchStatsDelta, b: MatchStatsDelta): MatchStatsDelta => ({
  kills: a.kills + b.kills,
  wins: a.wins + b.wins,
  matches: a.matches + b.matches,
  top5: a.top5 + b.top5,
  grenadeKills: a.grenadeKills + b.grenadeKills,
  abilityUses: a.abilityUses + b.abilityUses,
});

export interface MissionState {
  daily: Record<string, { progress: number; claimed: boolean }>;
  weekly: Record<string, { progress: number; claimed: boolean }>;
  dailyDay: number;
  weeklyWeek: number;
}

export const DAILY_MISSION_POOL: MissionDef[] = [
  { id: 'd-kills-5', kind: 'kills', target: 5, reward: { nx: 100 }, descEs: 'Consigue 5 bajas', descEn: 'Get 5 kills' },
  { id: 'd-kills-10', kind: 'kills', target: 10, reward: { nx: 180 }, descEs: 'Consigue 10 bajas', descEn: 'Get 10 kills' },
  { id: 'd-matches-3', kind: 'matches', target: 3, reward: { nx: 120 }, descEs: 'Juega 3 partidas', descEn: 'Play 3 matches' },
  { id: 'd-top5-2', kind: 'top5', target: 2, reward: { nx: 150, xp: 100 }, descEs: 'Termina 2 veces en Top 5', descEn: 'Reach Top 5 twice' },
  { id: 'd-grenade-2', kind: 'grenadeKills', target: 2, reward: { nx: 130 }, descEs: '2 bajas con granada', descEn: '2 grenade kills' },
  { id: 'd-ability-5', kind: 'abilityUses', target: 5, reward: { nx: 90 }, descEs: 'Usa tu habilidad 5 veces', descEn: 'Use your ability 5 times' },
  { id: 'd-win-1', kind: 'wins', target: 1, reward: { nx: 250, dalos: 20 }, descEs: 'Gana 1 partida', descEn: 'Win 1 match' },
];

export const WEEKLY_MISSIONS: MissionDef[] = [
  { id: 'w-kills-50', kind: 'kills', target: 50, reward: { nx: 800, dalos: 50 }, descEs: '50 bajas esta semana', descEn: '50 kills this week' },
  { id: 'w-matches-15', kind: 'matches', target: 15, reward: { nx: 600 }, descEs: 'Juega 15 partidas', descEn: 'Play 15 matches' },
  { id: 'w-wins-5', kind: 'wins', target: 5, reward: { nx: 1000, dalos: 80 }, descEs: 'Gana 5 partidas', descEn: 'Win 5 matches' },
  { id: 'w-top5-10', kind: 'top5', target: 10, reward: { nx: 700 }, descEs: '10 veces en Top 5', descEn: 'Reach Top 5 ten times' },
];

export const dayNumber = (tsMs: number): number => Math.floor(tsMs / 86_400_000);
export const weekNumber = (tsMs: number): number => Math.floor(tsMs / (7 * 86_400_000));

/** Rotación determinista: 3 misiones diarias según el día del año. */
export const dailyMissionsFor = (tsMs: number): MissionDef[] => {
  const day = dayNumber(tsMs);
  const out: MissionDef[] = [];
  for (let i = 0; i < 3; i++) {
    out.push(DAILY_MISSION_POOL[(day * 3 + i) % DAILY_MISSION_POOL.length]!);
  }
  return out;
};

export const freshMissionState = (tsMs: number): MissionState => {
  const daily: MissionState['daily'] = {};
  for (const m of dailyMissionsFor(tsMs)) daily[m.id] = { progress: 0, claimed: false };
  const weekly: MissionState['weekly'] = {};
  for (const m of WEEKLY_MISSIONS) weekly[m.id] = { progress: 0, claimed: false };
  return { daily, weekly, dailyDay: dayNumber(tsMs), weeklyWeek: weekNumber(tsMs) };
};

export const rollOverIfNeeded = (state: MissionState, tsMs: number): MissionState => {
  const day = dayNumber(tsMs);
  const week = weekNumber(tsMs);
  if (state.dailyDay === day && state.weeklyWeek === week) return state;
  const fresh = freshMissionState(tsMs);
  if (state.weeklyWeek === week) fresh.weekly = state.weekly;
  return fresh;
};

export const recordMatchInMissions = (state: MissionState, delta: MatchStatsDelta): MissionState => {
  const apply = (record: MissionState['daily'], defs: MissionDef[]): MissionState['daily'] => {
    const next = { ...record };
    for (const def of defs) {
      const cur = next[def.id] ?? { progress: 0, claimed: false };
      if (cur.claimed) continue;
      next[def.id] = { ...cur, progress: Math.min(def.target, cur.progress + delta[def.kind]) };
    }
    return next;
  };
  return {
    ...state,
    daily: apply(state.daily, Object.keys(state.daily).map((id) => DAILY_MISSION_POOL.find((m) => m.id === id) ?? WEEKLY_MISSIONS.find((m) => m.id === id)!)),
    weekly: apply(state.weekly, WEEKLY_MISSIONS),
  };
};

export const missionComplete = (def: MissionDef, entry: { progress: number; claimed: boolean }): boolean =>
  entry.progress >= def.target;

export const claimMissionReward = (
  state: MissionState,
  period: 'daily' | 'weekly',
  missionId: string,
): { state: MissionState; reward: MissionDef['reward'] | null } => {
  const defs = period === 'daily' ? DAILY_MISSION_POOL : WEEKLY_MISSIONS;
  const def = defs.find((m) => m.id === missionId);
  if (!def) return { state, reward: null };
  const entry = state[period][missionId];
  if (!entry || entry.claimed || entry.progress < def.target) return { state, reward: null };
  const next = { ...state, [period]: { ...state[period], [missionId]: { ...entry, claimed: true } } };
  return { state: next as MissionState, reward: def.reward };
};

/* ===== Logros ===== */

export type AchievementKind = 'kills' | 'wins' | 'matches' | 'top5';

export interface Achievement {
  id: string;
  descEs: string;
  descEn: string;
  kind: AchievementKind;
  target: number;
  reward: { nx?: number; dalos?: number };
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'a-kills-100', kind: 'kills', target: 100, reward: { nx: 500 }, descEs: '100 bajas totales', descEn: '100 total kills' },
  { id: 'a-kills-500', kind: 'kills', target: 500, reward: { dalos: 150 }, descEs: '500 bajas totales', descEn: '500 total kills' },
  { id: 'a-kills-1000', kind: 'kills', target: 1000, reward: { dalos: 400 }, descEs: '1.000 bajas totales', descEn: '1,000 total kills' },
  { id: 'a-wins-10', kind: 'wins', target: 10, reward: { nx: 800 }, descEs: '10 victorias', descEn: '10 victories' },
  { id: 'a-wins-50', kind: 'wins', target: 50, reward: { dalos: 250 }, descEs: '50 victorias', descEn: '50 victories' },
  { id: 'a-matches-100', kind: 'matches', target: 100, reward: { nx: 600 }, descEs: '100 partidas jugadas', descEn: '100 matches played' },
  { id: 'a-top5-25', kind: 'top5', target: 25, reward: { nx: 400 }, descEs: '25 veces en Top 5', descEn: '25 Top 5 finishes' },
];

export const achievementProgress = (a: Achievement, totals: MatchStatsDelta): number =>
  Math.min(1, totals[a.kind] / a.target);

export const achievementsCompleted = (totals: MatchStatsDelta): Achievement[] =>
  ACHIEVEMENTS.filter((a) => totals[a.kind] >= a.target);

/* ===== Login diario ===== */

export interface DailyLoginReward {
  day: number;
  nx: number;
  dalos: number;
}

export const DAILY_LOGIN_CYCLE: DailyLoginReward[] = [
  { day: 1, nx: 100, dalos: 0 },
  { day: 2, nx: 150, dalos: 0 },
  { day: 3, nx: 200, dalos: 10 },
  { day: 4, nx: 250, dalos: 0 },
  { day: 5, nx: 300, dalos: 10 },
  { day: 6, nx: 400, dalos: 20 },
  { day: 7, nx: 800, dalos: 50 },
];

export const dailyLoginRewardFor = (streakDay: number): DailyLoginReward => {
  const idx = (Math.max(1, streakDay) - 1) % DAILY_LOGIN_CYCLE.length;
  return DAILY_LOGIN_CYCLE[idx]!;
};

export const canClaimDailyLogin = (lastClaimDay: number, today: number): boolean =>
  today > lastClaimDay;

export const nextStreakDay = (lastClaimDay: number, today: number): number =>
  today - lastClaimDay === 1 ? today % 7 || 7 : 1;

/* ===== Rangos clasificatorios ===== */

export interface RankTier {
  nameEs: string;
  nameEn: string;
  minPoints: number;
  color: string;
}

export const RANK_TIERS: RankTier[] = [
  { nameEs: 'Bronce', nameEn: 'Bronze', minPoints: 0, color: '#b0793d' },
  { nameEs: 'Plata', nameEn: 'Silver', minPoints: 400, color: '#b7c3d8' },
  { nameEs: 'Oro', nameEn: 'Gold', minPoints: 900, color: '#f2b632' },
  { nameEs: 'Platino', nameEn: 'Platinum', minPoints: 1500, color: '#7de8ff' },
  { nameEs: 'Diamante', nameEn: 'Diamond', minPoints: 2200, color: '#b06bff' },
  { nameEs: 'Nexo', nameEn: 'Nexo', minPoints: 3000, color: '#38e1c8' },
];

export const rankFromPoints = (points: number): RankTier => {
  let tier = RANK_TIERS[0]!;
  for (const t of RANK_TIERS) if (points >= t.minPoints) tier = t;
  return tier;
};

/** RR ganados/perdidos en clasificatorio: más kills y mejor posición, más RR. */
export const rankedPointsDelta = (kills: number, placement: number, totalPlayers: number): number => {
  const killPoints = kills * 6;
  const placementPoints = Math.max(-30, Math.round(((totalPlayers - placement) / totalPlayers) * 60) - 30);
  const winBonus = placement === 1 ? 40 : 0;
  return killPoints + placementPoints + winBonus;
};
