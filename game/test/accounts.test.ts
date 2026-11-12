import { describe, expect, it, beforeEach } from 'vitest';
import { rmSync } from 'node:fs';
import { AccountStore } from '../src/server/accounts.js';
import {
  dailyMissionsFor,
  freshMissionState,
  rollOverIfNeeded,
  recordMatchInMissions,
  claimMissionReward,
  missionComplete,
  achievementsCompleted,
  dailyLoginRewardFor,
  nextStreakDay,
  rankFromPoints,
  rankedPointsDelta,
  RANK_TIERS,
  emptyStatsDelta,
  addStatsDelta,
} from '../src/meta/progression.js';
import {
  vipIsActive,
  vipActivate,
  vipDailyClaimAvailable,
  vipNxBonus,
  craftItem,
  fragmentsNeededFor,
  eventIsActive,
  eventExchange,
  validateRedeemCode,
  normalizeCode,
  canRedeemAgain,
} from '../src/meta/economy.js';
import { GAME_MODES, isWeaponAllowedInMode, GAME_MODE_IDS } from '../src/shared/gameModes.js';
import { MatchSim } from '../src/shared/sim.js';

const DATA_FILE = '/tmp/nexo-test-accounts.json';

describe('cuentas (registro, login, 2FA, baneos, clanes, códigos)', () => {
  beforeEach(() => rmSync(DATA_FILE, { force: true }));

  it('registra con hash scrypt (nunca guarda la contraseña en claro)', () => {
    const store = new AccountStore(DATA_FILE);
    const r = store.register('jugador@nexo.gg', 'contrasena-segura', 'NexoFan');
    expect(r.ok).toBe(true);
    const raw = require('node:fs').readFileSync(DATA_FILE, 'utf8');
    expect(raw).not.toContain('contrasena-segura');
    expect(raw).toContain('passwordHash');
  });

  it('rechaza correos inválidos, contraseñas cortas y duplicados', () => {
    const store = new AccountStore(DATA_FILE);
    expect(store.register('no-es-correo', 'contrasena-segura', 'A').ok).toBe(false);
    expect(store.register('a@b.co', 'corta', 'A').ok).toBe(false);
    expect(store.register('a@b.co', 'contrasena-segura', 'A').ok).toBe(true);
    expect(store.register('a@b.co', 'contrasena-segura', 'B').ok).toBe(false);
    expect(store.register('c@d.co', 'contrasena-segura', 'A').ok).toBe(false);
  });

  it('login correcto e incorrecto; sesión válida con token', () => {
    const store = new AccountStore(DATA_FILE);
    store.register('a@b.co', 'contrasena-segura', 'NexoFan');
    expect(store.login('a@b.co', 'mal-password', null).ok).toBe(false);
    const login = store.login('a@b.co', 'contrasena-segura', null);
    expect(login.ok).toBe(true);
    if (login.ok) {
      expect(store.auth(login.token)?.name).toBe('NexoFan');
    }
    expect(store.auth('token-inventado')).toBeNull();
  });

  it('2FA TOTP genera códigos de 6 dígitos que se verifican', () => {
    const store = new AccountStore(DATA_FILE);
    store.register('a@b.co', 'contrasena-segura', 'NexoFan');
    const login = store.login('a@b.co', 'contrasena-segura', null);
    if (!login.ok) throw new Error('login falló');
    const { secret, otpauthUrl } = store.enableTotp(login.account);
    expect(otpauthUrl).toContain('otpauth://totp/NexoFPS:');
    expect(secret).toMatch(/^[0-9a-f]{20}$/);
    const counter = Math.floor(Date.now() / 30_000);
    const code = (store as unknown as { totpAt(s: string, c: number): string }).totpAt(secret, counter);
    expect(code).toMatch(/^\d{6}$/);
    expect(store.confirmTotp(login.account, code)).toBe(true);
    expect(store.login('a@b.co', 'contrasena-segura', null).ok).toBe(false);
    const withTotp = store.login('a@b.co', 'contrasena-segura', code);
    expect(withTotp.ok).toBe(true);
  });

  it('banea y bloquea el login; reportes se registran', () => {
    const store = new AccountStore(DATA_FILE);
    const reg = store.register('a@b.co', 'contrasena-segura', 'NexoFan');
    if (!reg.ok) throw new Error('registro falló');
    const login = store.login('a@b.co', 'contrasena-segura', null);
    if (!login.ok) throw new Error('login falló');
    store.ban(reg.account.id, 'trampa', 0);
    expect(store.login('a@b.co', 'contrasena-segura', null)).toMatchObject({ ok: false, reason: 'banned' });
    store.unban(reg.account.id);
    expect(store.login('a@b.co', 'contrasena-segura', null).ok).toBe(true);
    store.fileReport(reg.account.id, login.account.id, 'está usando speedhack');
    expect(store.listReports()).toHaveLength(1);
  });

  it('amigos y clanes con moneda de clan', () => {
    const store = new AccountStore(DATA_FILE);
    const a = store.register('a@b.co', 'contrasena-segura', 'Lider');
    const b = store.register('c@d.co', 'contrasena-segura', 'Miembro');
    if (!a.ok || !b.ok) throw new Error('registro falló');
    const loginB = store.login('c@d.co', 'contrasena-segura', null);
    if (!loginB.ok) throw new Error('login falló');
    const clan = store.createClan(loginB.account, 'Fuerza Nexo');
    expect(clan.ok).toBe(true);
    expect(store.addFriend(loginB.account, 'Lider').ok).toBe(true);
    expect(store.addFriend(loginB.account, 'Lider').ok).toBe(false);
    expect(store.friendNames(loginB.account)).toEqual(['Lider']);
    expect(store.joinClan(a.account, 'Fuerza Nexo').ok).toBe(true);
    expect(store.clanInfo(a.account)?.members).toEqual(['Miembro', 'Lider']);
    expect(store.addClanCoins(store.clanInfo(a.account) ? (clan as { clan?: { id: string } }).clan!.id : '', 100)).toBe(true);
    expect(store.leaveClan(a.account).ok).toBe(true);
  });

  it('códigos de canje: válido, expirado, agotado y cooldown', () => {
    const store = new AccountStore(DATA_FILE);
    const reg = store.register('a@b.co', 'contrasena-segura', 'NexoFan');
    if (!reg.ok) throw new Error('registro falló');
    const login = store.login('a@b.co', 'contrasena-segura', null);
    if (!login.ok) throw new Error('login falló');
    const now = 1_700_000_000_000;
    store.addRedeemCode('NEXO-2026', { nx: 500 }, now + 86_400_000, 2);
    expect(store.redeem(login.account, 'nexo-2026', now)).toMatchObject({ ok: true, reward: { nx: 500 } });
    expect(store.redeem(login.account, 'NEXO-2026', now + 1000).ok).toBe(false);
    const other = store.register('c@d.co', 'contrasena-segura', 'Otro');
    if (!other.ok) throw new Error('registro 2 falló');
    const login2 = store.login('c@d.co', 'contrasena-segura', null);
    if (!login2.ok) throw new Error('login 2 falló');
    expect(store.redeem(login2.account, 'NEXO-2026', now)).toMatchObject({ ok: true });
    expect(store.redeem(login2.account, 'NEXO-9999', now).reason).toBe('redeem-cooldown');
    expect(store.redeem(login2.account, 'NEXO-9999', now + 61_000).reason).toBe('code-not-found');
  });

  it('estadísticas y tabla de clasificación', () => {
    const store = new AccountStore(DATA_FILE);
    const a = store.register('a@b.co', 'contrasena-segura', 'Pro');
    if (!a.ok) throw new Error('registro falló');
    store.recordMatch(a.account.id, { kills: 7, wins: 1, top5: true, rankedPoints: 82, fragments: 5 });
    store.recordMatch(a.account.id, { kills: 3, rankedPoints: 30, fragments: 5 });
    const login = store.login('a@b.co', 'contrasena-segura', null);
    if (!login.ok) throw new Error('login falló');
    expect(login.account.stats.kills).toBe(10);
    expect(login.account.stats.matches).toBe(2);
    expect(login.account.stats.wins).toBe(1);
    expect(login.account.stats.fragments).toBe(10);
    const board = store.leaderboard('kills');
    expect(board[0]).toEqual({ name: 'Pro', value: 10 });
  });

  it('login diario con ciclo de 7 días y premio grande el día 7', () => {
    const store = new AccountStore(DATA_FILE);
    const reg = store.register('a@b.co', 'contrasena-segura', 'NexoFan');
    if (!reg.ok) throw new Error('registro falló');
    const login = store.login('a@b.co', 'contrasena-segura', null);
    if (!login.ok) throw new Error('login falló');
    const day1 = 20_000 * 86_400_000;
    const r1 = store.claimDailyLogin(login.account, day1);
    expect(r1.ok).toBe(true);
    expect(r1.streak).toBe(1);
    expect(store.claimDailyLogin(login.account, day1).ok).toBe(false);
    const r2 = store.claimDailyLogin(login.account, day1 + 86_400_000);
    expect(r2.streak).toBe(2);
  });
});

describe('misiones y logros', () => {
  it('rota 3 misiones diarias de forma determinista', () => {
    const day1 = dailyMissionsFor(10 * 86_400_000);
    const day2 = dailyMissionsFor(11 * 86_400_000);
    expect(day1).toHaveLength(3);
    expect(day1.some((m) => !day2.includes(m))).toBe(true);
    expect(dailyMissionsFor(10 * 86_400_000)).toEqual(day1);
  });

  it('el progreso se registra, se completa y se reclama una vez', () => {
    const now = 100 * 86_400_000;
    let state = freshMissionState(now);
    const defs = dailyMissionsFor(now);
    const def = defs[0]!;
    state = recordMatchInMissions(state, { ...emptyStatsDelta(), [def.kind]: def.target - 1 } as never);
    expect(missionComplete(def, state.daily[def.id]!)).toBe(false);
    state = recordMatchInMissions(state, { ...emptyStatsDelta(), [def.kind]: 1 } as never);
    expect(missionComplete(def, state.daily[def.id]!)).toBe(true);
    const claimed = claimMissionReward(state, 'daily', def.id);
    expect(claimed.reward).toEqual(def.reward);
    expect(claimed.state.daily[def.id]!.claimed).toBe(true);
    expect(claimMissionReward(claimed.state, 'daily', def.id).reward).toBeNull();
  });

  it('las misiones se reinician al cambiar el día (y no la semana)', () => {
    const now = 100 * 86_400_000;
    let state = freshMissionState(now);
    state = recordMatchInMissions(state, { ...emptyStatsDelta(), kills: 10 });
    const nextDay = rollOverIfNeeded(state, now + 86_400_000);
    expect(Object.values(nextDay.daily).every((e) => e.progress === 0)).toBe(true);
    const sameDay = rollOverIfNeeded(state, now + 3_600_000);
    expect(sameDay).toBe(state);
  });

  it('los logros se completan por umbrales de estadísticas', () => {
    const totals = { ...emptyStatsDelta(), kills: 120, wins: 11, matches: 101, top5: 26 };
    const done = achievementsCompleted(totals).map((a) => a.id);
    expect(done).toContain('a-kills-100');
    expect(done).toContain('a-wins-10');
    expect(done).toContain('a-matches-100');
    expect(done).toContain('a-top5-25');
    expect(done).not.toContain('a-kills-500');
  });

  it('login diario: ciclo de 7 días con premio grande', () => {
    expect(dailyLoginRewardFor(1).nx).toBe(100);
    expect(dailyLoginRewardFor(7).dalos).toBe(50);
    expect(dailyLoginRewardFor(8)).toEqual(dailyLoginRewardFor(1));
    expect(nextStreakDay(100, 101)).toBe(101 % 7 || 7);
    expect(nextStreakDay(100, 105)).toBe(1);
  });

  it('rangos: de Bronce a Nexo y RR por resultado', () => {
    expect(rankFromPoints(0).nameEs).toBe('Bronce');
    expect(rankFromPoints(950).nameEs).toBe('Oro');
    expect(rankFromPoints(99999).nameEs).toBe('Nexo');
    expect(RANK_TIERS).toHaveLength(6);
    const win = rankedPointsDelta(8, 1, 12);
    const earlyExit = rankedPointsDelta(0, 12, 12);
    expect(win).toBeGreaterThan(0);
    expect(earlyExit).toBeLessThan(0);
  });
});

describe('economía extendida', () => {
  it('VIP: se activa 30 días, reclama diario y da bonus NX', () => {
    const now = 1_700_000_000_000;
    expect(vipIsActive(0, now)).toBe(false);
    const until = vipActivate(0, now);
    expect(vipIsActive(until, now + 86_400_000)).toBe(true);
    expect(vipDailyClaimAvailable(until, 0, now + 86_400_000)).toBe(true);
    expect(vipDailyClaimAvailable(until, now + 86_400_000, now + 86_400_000)).toBe(false);
    expect(vipNxBonus(100)).toBe(20);
  });

  it('fragmentos: cuesta más por rareza y fabrica si alcanza', () => {
    expect(fragmentsNeededFor('raro')).toBeLessThan(fragmentsNeededFor('legendario'));
    expect(craftItem(59, 'raro').ok).toBe(false);
    expect(craftItem(60, 'raro')).toEqual({ ok: true, balance: 0 });
    expect(craftItem(100, 'epico').ok).toBe(false);
  });

  it('moneda de evento: caduca y valida el intercambio', () => {
    const now = 1_700_000_000_000;
    const event = {
      id: 'e1', nameEs: 'Evento', nameEn: 'Event', endsAtMs: now + 1000,
      tokenNameEs: 'Chispas', tokenNameEn: 'Sparks',
      exchange: [{ sku: 'skin-x', cost: 100, labelEs: 'Skin X', labelEn: 'Skin X' }],
    };
    expect(eventIsActive(event, now)).toBe(true);
    expect(eventIsActive(event, now + 2000)).toBe(false);
    expect(eventExchange(event, 50, 100, now)).toMatchObject({ ok: false, reason: 'insufficient-tokens' });
    expect(eventExchange(event, 150, 100, now)).toMatchObject({ ok: true, balance: 50 });
    expect(eventExchange(event, 150, 100, now + 2000).reason).toBe('event-ended');
  });

  it('códigos: normalización y validación pura', () => {
    expect(normalizeCode(' nexo-2026! ')).toBe('NEXO-2026');
    expect(validateRedeemCode(undefined, 0).reason).toBe('code-not-found');
    expect(validateRedeemCode({ code: 'X', reward: { nx: 1 }, expiresAtMs: 100, maxUses: 1, uses: 1 }, 0).reason).toBe('code-exhausted');
    expect(validateRedeemCode({ code: 'X', reward: { nx: 1 }, expiresAtMs: 100, maxUses: 1, uses: 0 }, 100).reason).toBe('code-expired');
    expect(validateRedeemCode({ code: 'X', reward: { nx: 1 }, expiresAtMs: 100, maxUses: 1, uses: 0 }, 50).ok).toBe(true);
    expect(canRedeemAgain(0, 60_000)).toBe(true);
    expect(canRedeemAgain(0, 1000)).toBe(false);
  });
});

describe('modos de juego', () => {
  it('define 10 modos con 4 implementados que cambian la simulación', () => {
    expect(GAME_MODE_IDS).toHaveLength(10);
    const implemented = GAME_MODE_IDS.filter((id) => GAME_MODES[id].implemented);
    expect(implemented).toEqual(expect.arrayContaining(['solo', 'clasificatorio', 'rapido', 'solo-pistolas']));
  });

  it('solo pistolas: el saqueo se restringe a pistolas y revólver', () => {
    const sim = new MatchSim({ seed: 5, botCount: 0, dropPhaseMs: 1000, modeId: 'solo-pistolas' });
    const weapons = sim.items.filter((i) => i.kind === 'weapon').map((i) => i.weaponId);
    expect(weapons.length).toBeGreaterThan(0);
    expect(weapons.every((w) => w === 'pistola' || w === 'revolver')).toBe(true);
  });

  it('modo rápido: la zona avanza más rápido que en solo', () => {
    const normal = new MatchSim({ seed: 9, botCount: 6, dropPhaseMs: 0 });
    const rapid = new MatchSim({ seed: 9, botCount: 6, dropPhaseMs: 0, modeId: 'rapido' });
    normal.startDrop();
    rapid.startDrop();
    for (let i = 0; i < 300; i++) {
      normal.tick(100);
      rapid.tick(100);
    }
    expect(normal.phase).toBe('play');
    expect(rapid.phase).toBe('play');
    expect(rapid.zone.radius).toBeLessThan(normal.zone.radius);
  });

  it('isWeaponAllowedInMode respeta la lista blanca', () => {
    const mode = GAME_MODES['solo-pistolas'];
    expect(isWeaponAllowedInMode(mode, 'pistola')).toBe(true);
    expect(isWeaponAllowedInMode(mode, 'francotirador')).toBe(false);
    expect(isWeaponAllowedInMode(GAME_MODES.solo, 'francotirador')).toBe(true);
  });

  it('addStatsDelta suma estadísticas para misiones', () => {
    const a = { ...emptyStatsDelta(), kills: 3, matches: 1 };
    const b = { ...emptyStatsDelta(), kills: 2, wins: 1 };
    const total = addStatsDelta(a, b);
    expect(total.kills).toBe(5);
    expect(total.matches).toBe(1);
    expect(total.wins).toBe(1);
  });
});
