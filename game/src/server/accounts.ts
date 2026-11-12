import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Cuentas persistentes del servidor (JSON atómico, sin dependencias externas).
 *
 *  - Registro y login con correo + contraseña (scrypt con salt por cuenta).
 *  - Verificación en dos pasos TOTP (RFC 6238, compatible con Google Authenticator).
 *  - Sesiones con token opaco de 30 días.
 *  - Baneos temporales o permanentes con motivo; reportes de jugadores.
 *  - Amigos, clanes (con moneda de clan) y estadísticas acumuladas.
 *  - Tabla de clasificación por cualquier métrica.
 */

export interface AccountStats {
  kills: number;
  wins: number;
  matches: number;
  top5: number;
  grenadeKills: number;
  abilityUses: number;
  rankedPoints: number;
  fragments: number;
  eventTokens: number;
  passXp: number;
}

export interface Account {
  id: string;
  email: string;
  name: string;
  nameLower: string;
  avatarId: string;
  createdAtMs: number;
  passwordSalt: string;
  passwordHash: string;
  totpSecret: string | null;
  totpEnabled: boolean;
  sessions: Array<{ token: string; expiresAtMs: number }>;
  banned: { reason: string; untilMs: number } | null;
  stats: AccountStats;
  friends: string[];
  clanId: string | null;
  missions: unknown;
  achievementsClaimed: string[];
  dailyLogin: { lastClaimDay: number; streak: number };
  vipUntilMs: number;
  lastVipClaimMs: number;
  lastRedeemMs: number;
  redeemedCodes: string[];
}

export interface Clan {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
  coins: number;
  createdAtMs: number;
}

export interface Report {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  createdAtMs: number;
}

const SESSION_MS = 30 * 86_400_000;
const scrypt = (password: string, salt: string): string =>
  scryptSync(password, salt, 32).toString('hex');

export class AccountStore {
  private accounts = new Map<string, Account>();
  private clans = new Map<string, Clan>();
  private reports: Report[] = [];
  private redeemCodes = new Map<string, { reward: { nx?: number; dalos?: number }; expiresAtMs: number; maxUses: number; uses: number }>();

  constructor(private readonly dataFile: string) {
    this.load();
  }

  private load(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(this.dataFile, 'utf8')) as {
        accounts: Account[];
        clans: Clan[];
        reports: Report[];
        redeemCodes: Array<[string, { reward: { nx?: number; dalos?: number }; expiresAtMs: number; maxUses: number; uses: number }]>;
      };
      for (const a of raw.accounts ?? []) this.accounts.set(a.id, a);
      for (const c of raw.clans ?? []) this.clans.set(c.id, c);
      this.reports = raw.reports ?? [];
      for (const [code, def] of raw.redeemCodes ?? []) this.redeemCodes.set(code, def);
    } catch {
      /* primera ejecución: datos vacíos */
    }
  }

  private save(): void {
    const dir = path.dirname(this.dataFile);
    fs.mkdirSync(dir, { recursive: true });
    const data = {
      accounts: [...this.accounts.values()],
      clans: [...this.clans.values()],
      reports: this.reports,
      redeemCodes: [...this.redeemCodes.entries()],
    };
    const tmp = `${this.dataFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, this.dataFile);
  }

  /* ===== Registro y login ===== */

  register(email: string, password: string, name: string, nowMs = Date.now()):
    { ok: true; account: Account } | { ok: false; reason: string } {
    const emailNorm = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) return { ok: false, reason: 'invalid-email' };
    if (password.length < 8) return { ok: false, reason: 'password-too-short' };
    if ([...this.accounts.values()].some((a: Account) => a.email === emailNorm)) return { ok: false, reason: 'email-taken' };
    const cleanName = name.trim().slice(0, 16) || 'Jugador';
    if ([...this.accounts.values()].some((a: Account) => a.nameLower === cleanName.toLowerCase())) return { ok: false, reason: 'name-taken' };
    const salt = randomBytes(16).toString('hex');
    const account: Account = {
      id: randomUUID(),
      email: emailNorm,
      name: cleanName,
      nameLower: cleanName.toLowerCase(),
      avatarId: 'aurora',
      createdAtMs: nowMs,
      passwordSalt: salt,
      passwordHash: scrypt(password, salt),
      totpSecret: null,
      totpEnabled: false,
      sessions: [],
      banned: null,
      stats: {
        kills: 0, wins: 0, matches: 0, top5: 0, grenadeKills: 0, abilityUses: 0,
        rankedPoints: 0, fragments: 0, eventTokens: 0, passXp: 0,
      },
      friends: [],
      clanId: null,
      missions: null,
      achievementsClaimed: [],
      dailyLogin: { lastClaimDay: 0, streak: 0 },
      vipUntilMs: 0,
      lastVipClaimMs: 0,
      lastRedeemMs: 0,
      redeemedCodes: [],
    };
    this.accounts.set(account.id, account);
    this.save();
    return { ok: true, account };
  }

  login(email: string, password: string, totpCode: string | null, nowMs = Date.now()):
    { ok: true; account: Account; token: string } | { ok: false; reason: string } {
    const emailNorm = email.trim().toLowerCase();
    const account = [...this.accounts.values()].find((a: Account) => a.email === emailNorm);
    if (!account) return { ok: false, reason: 'invalid-credentials' };
    const hash = scrypt(password, account.passwordSalt);
    const expected = Buffer.from(account.passwordHash, 'hex');
    const given = Buffer.from(hash, 'hex');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return { ok: false, reason: 'invalid-credentials' };
    }
    if (account.banned) {
      if (account.banned.untilMs === 0 || account.banned.untilMs > nowMs) {
        return { ok: false, reason: 'banned' };
      }
      account.banned = null;
    }
    if (account.totpEnabled) {
      if (!totpCode) return { ok: false, reason: 'totp-required' };
      if (!this.verifyTotp(account, totpCode, nowMs)) return { ok: false, reason: 'totp-invalid' };
    }
    const token = randomBytes(32).toString('hex');
    account.sessions = account.sessions.filter((s) => s.expiresAtMs > nowMs);
    account.sessions.push({ token, expiresAtMs: nowMs + SESSION_MS });
    this.save();
    return { ok: true, account, token };
  }

  auth(token: string, nowMs = Date.now()): Account | null {
    const account = [...this.accounts.values()].find((a: Account) => a.sessions.some((s) => s.token === token && s.expiresAtMs > nowMs));
    return account ?? null;
  }

  logout(token: string): void {
    for (const account of this.accounts.values()) {
      const before = account.sessions.length;
      account.sessions = account.sessions.filter((s) => s.token !== token);
      if (account.sessions.length !== before) {
        this.save();
        return;
      }
    }
  }

  /* ===== TOTP (RFC 6238) ===== */

  enableTotp(account: Account, nowMs = Date.now()): { secret: string; otpauthUrl: string } {
    const secret = account.totpSecret ?? randomBytes(10).toString('hex');
    account.totpSecret = secret;
    this.save();
    return {
      secret,
      otpauthUrl: `otpauth://totp/NexoFPS:${encodeURIComponent(account.email)}?secret=${secret}&issuer=NexoFPS`,
    };
  }

  confirmTotp(account: Account, code: string, nowMs = Date.now()): boolean {
    if (!account.totpSecret) return false;
    if (!this.verifyTotp(account, code, nowMs)) return false;
    account.totpEnabled = true;
    this.save();
    return true;
  }

  private verifyTotp(account: Account, code: string, nowMs: number): boolean {
    if (!account.totpSecret) return false;
    const counter = Math.floor(nowMs / 30_000);
    for (const drift of [-1, 0, 1]) {
      if (this.totpAt(account.totpSecret, counter + drift) === code.trim()) return true;
    }
    return false;
  }

  private totpAt(secretHex: string, counter: number): string {
    const key = Buffer.from(secretHex, 'hex');
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buf.writeUInt32BE(counter >>> 0, 4);
    const hmac = createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1]! & 0x0f;
    const bin =
      ((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff);
    return String(bin % 1_000_000).padStart(6, '0');
  }

  /* ===== Perfil, baneos y reportes ===== */

  updateProfile(account: Account, patch: { name?: string; avatarId?: string }): { ok: boolean; reason?: string } {
    if (patch.name) {
      const clean = patch.name.trim().slice(0, 16);
      if (!clean) return { ok: false, reason: 'invalid-name' };
      if ([...this.accounts.values()].some((a: Account) => a.id !== account.id && a.nameLower === clean.toLowerCase())) {
        return { ok: false, reason: 'name-taken' };
      }
      account.name = clean;
      account.nameLower = clean.toLowerCase();
    }
    if (patch.avatarId) account.avatarId = patch.avatarId.slice(0, 24);
    this.save();
    return { ok: true };
  }

  ban(accountId: string, reason: string, untilMs: number): boolean {
    const account = this.accounts.get(accountId);
    if (!account) return false;
    account.banned = { reason, untilMs };
    account.sessions = [];
    this.save();
    return true;
  }

  unban(accountId: string): boolean {
    const account = this.accounts.get(accountId);
    if (!account) return false;
    account.banned = null;
    this.save();
    return true;
  }

  fileReport(reportedId: string, reporterId: string, reason: string, nowMs = Date.now()): Report {
    const report: Report = {
      id: randomUUID(),
      reportedId,
      reporterId,
      reason: reason.slice(0, 280),
      createdAtMs: nowMs,
    };
    this.reports.push(report);
    this.save();
    return report;
  }

  listReports(): Report[] {
    return this.reports;
  }

  /* ===== Estadísticas y ranking ===== */

  recordMatch(accountId: string, delta: Partial<AccountStats> & { top5?: boolean }, nowMs = Date.now()): Account | null {
    const account = this.accounts.get(accountId);
    if (!account) return null;
    account.stats.kills += delta.kills ?? 0;
    account.stats.grenadeKills += delta.grenadeKills ?? 0;
    account.stats.abilityUses += delta.abilityUses ?? 0;
    account.stats.fragments += delta.fragments ?? 0;
    account.stats.eventTokens += delta.eventTokens ?? 0;
    account.stats.passXp += delta.passXp ?? 0;
    account.stats.matches += 1;
    if (delta.top5) account.stats.top5 += 1;
    if (delta.wins) account.stats.wins += 1;
    account.stats.rankedPoints += delta.rankedPoints ?? 0;
    account.stats.rankedPoints = Math.max(0, account.stats.rankedPoints);
    void nowMs;
    this.save();
    return account;
  }

  leaderboard(field: keyof AccountStats, limit = 20): Array<{ name: string; value: number }> {
    return [...this.accounts.values()]
      .map((a) => ({ name: a.name, value: a.stats[field] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, Math.min(100, limit));
  }

  /* ===== Amigos ===== */

  addFriend(account: Account, friendName: string): { ok: boolean; reason?: string } {
    const friend = [...this.accounts.values()].find((a: Account) => a.nameLower === friendName.trim().toLowerCase());
    if (!friend) return { ok: false, reason: 'friend-not-found' };
    if (friend.id === account.id) return { ok: false, reason: 'cannot-add-self' };
    if (account.friends.includes(friend.id)) return { ok: false, reason: 'already-friends' };
    account.friends.push(friend.id);
    this.save();
    return { ok: true };
  }

  removeFriend(account: Account, friendId: string): boolean {
    const before = account.friends.length;
    account.friends = account.friends.filter((f) => f !== friendId);
    if (account.friends.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  friendNames(account: Account): string[] {
    return account.friends
      .map((id) => this.accounts.get(id)?.name)
      .filter((n): n is string => Boolean(n));
  }

  /* ===== Clanes ===== */

  createClan(account: Account, name: string, nowMs = Date.now()): { ok: boolean; reason?: string; clan?: Clan } {
    const clean = name.trim().slice(0, 20);
    if (clean.length < 3) return { ok: false, reason: 'clan-name-too-short' };
    if ([...this.clans.values()].some((c: Clan) => c.name.toLowerCase() === clean.toLowerCase())) {
      return { ok: false, reason: 'clan-name-taken' };
    }
    if (account.clanId) return { ok: false, reason: 'already-in-clan' };
    const clan: Clan = {
      id: randomUUID(),
      name: clean,
      leaderId: account.id,
      memberIds: [account.id],
      coins: 0,
      createdAtMs: nowMs,
    };
    this.clans.set(clan.id, clan);
    account.clanId = clan.id;
    this.save();
    return { ok: true, clan };
  }

  joinClan(account: Account, clanName: string): { ok: boolean; reason?: string } {
    const clan = [...this.clans.values()].find((c: Clan) => c.name.toLowerCase() === clanName.trim().toLowerCase());
    if (!clan) return { ok: false, reason: 'clan-not-found' };
    if (account.clanId) return { ok: false, reason: 'already-in-clan' };
    clan.memberIds.push(account.id);
    account.clanId = clan.id;
    this.save();
    return { ok: true };
  }

  leaveClan(account: Account): { ok: boolean; reason?: string } {
    if (!account.clanId) return { ok: false, reason: 'not-in-clan' };
    const clan = this.clans.get(account.clanId);
    if (clan) {
      clan.memberIds = clan.memberIds.filter((id) => id !== account.id);
      if (clan.leaderId === account.id) {
        const next = clan.memberIds[0];
        if (next) clan.leaderId = next;
        else this.clans.delete(clan.id);
      }
    }
    account.clanId = null;
    this.save();
    return { ok: true };
  }

  clanInfo(account: Account): { name: string; coins: number; members: string[]; isLeader: boolean } | null {
    if (!account.clanId) return null;
    const clan = this.clans.get(account.clanId);
    if (!clan) return null;
    return {
      name: clan.name,
      coins: clan.coins,
      members: clan.memberIds.map((id) => this.accounts.get(id)?.name ?? '?'),
      isLeader: clan.leaderId === account.id,
    };
  }

  addClanCoins(clanId: string, amount: number): boolean {
    const clan = this.clans.get(clanId);
    if (!clan) return false;
    clan.coins += Math.max(0, amount);
    this.save();
    return true;
  }

  /* ===== Códigos de canje ===== */

  addRedeemCode(code: string, reward: { nx?: number; dalos?: number }, expiresAtMs: number, maxUses = 100): void {
    this.redeemCodes.set(code.toUpperCase(), { reward, expiresAtMs, maxUses, uses: 0 });
    this.save();
  }

  redeem(account: Account, codeInput: string, nowMs = Date.now()):
    { ok: true; reward: { nx?: number; dalos?: number } } | { ok: false; reason: string } {
    if (nowMs - account.lastRedeemMs < 60_000) return { ok: false, reason: 'redeem-cooldown' };
    const code = codeInput.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (account.redeemedCodes.includes(code)) return { ok: false, reason: 'already-redeemed' };
    const def = this.redeemCodes.get(code);
    if (!def) return { ok: false, reason: 'code-not-found' };
    if (nowMs >= def.expiresAtMs) return { ok: false, reason: 'code-expired' };
    if (def.uses >= def.maxUses) return { ok: false, reason: 'code-exhausted' };
    def.uses += 1;
    account.lastRedeemMs = nowMs;
    account.redeemedCodes.push(code);
    this.save();
    return { ok: true, reward: def.reward };
  }

  /* ===== Login diario ===== */

  claimDailyLogin(account: Account, nowMs = Date.now()): { ok: boolean; streak?: number; nx?: number; dalos?: number; reason?: string } {
    const today = Math.floor(nowMs / 86_400_000);
    if (account.dailyLogin.lastClaimDay === today) return { ok: false, reason: 'already-claimed' };
    const streak = today - account.dailyLogin.lastClaimDay === 1 ? account.dailyLogin.streak + 1 : 1;
    const cycleDay = ((streak - 1) % 7) + 1;
    const table = [
      { nx: 100, dalos: 0 }, { nx: 150, dalos: 0 }, { nx: 200, dalos: 10 },
      { nx: 250, dalos: 0 }, { nx: 300, dalos: 10 }, { nx: 400, dalos: 20 },
      { nx: 800, dalos: 50 },
    ];
    const reward = table[cycleDay - 1]!;
    account.dailyLogin = { lastClaimDay: today, streak };
    this.save();
    return { ok: true, streak: cycleDay, ...reward };
  }

  count(): number {
    return this.accounts.size;
  }
}
