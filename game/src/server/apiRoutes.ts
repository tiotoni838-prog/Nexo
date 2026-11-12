import http from 'node:http';
import { AccountStore, type Account } from './accounts.js';
import { notifyOwner } from './telegram.js';

/**
 * Rutas HTTP de cuentas y social. Todas las respuestas son JSON.
 * Autenticación por header `Authorization: Bearer <token-sesion>`.
 *
 *  POST /api/auth/register   { email, password, name }
 *  POST /api/auth/login      { email, password, totpCode? }
 *  POST /api/auth/logout
 *  GET  /api/profile         → perfil + stats + clanes + amigos
 *  PATCH /api/profile        { name?, avatarId? }
 *  POST /api/profile/totp    → activa 2FA (devuelve secreto + otpauth URL)
 *  POST /api/profile/totp/confirm { code }
 *  POST /api/social/friend   { name }      · DELETE { id }
 *  POST /api/social/clan     { name }      · PUT { name } (unirse) · DELETE (salir)
 *  GET  /api/leaderboard?field=kills
 *  POST /api/reports         { reportedId, reason }
 *  POST /api/redeem          { code }
 *  POST /api/daily-login
 */

export interface ApiRoutesDeps {
  accounts: AccountStore | null;
}

const readBody = (req: http.IncomingMessage, maxBytes = 8192): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        req.destroy();
        reject(new Error('body-too-large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const publicAccount = (a: Account) => ({
  id: a.id,
  email: a.email,
  name: a.name,
  avatarId: a.avatarId,
  totpEnabled: a.totpEnabled,
  banned: a.banned,
  stats: a.stats,
  friends: a.friends.length,
  clanId: a.clanId,
  dailyLogin: a.dailyLogin,
  vipUntilMs: a.vipUntilMs,
});

export const handleApiRoutes = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  deps: ApiRoutesDeps,
): boolean => {
  const apiPaths = ['/api/auth', '/api/profile', '/api/social', '/api/leaderboard', '/api/reports', '/api/redeem', '/api/daily-login'];
  if (!apiPaths.some((p) => url.pathname.startsWith(p))) return false;

  const json = (status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const store = deps.accounts;
  if (!store) {
    json(503, { error: 'accounts-not-configured', msg: 'Define NEXO_DATA_DIR para activar cuentas.' });
    return true;
  }

  const sessionAccount = (): Account | null => {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) return null;
    return store.auth(header.slice(7).trim());
  };

  void (async () => {
    try {
      if (url.pathname === '/api/auth/register' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req)) as { email?: string; password?: string; name?: string };
        const result = store.register(body.email ?? '', body.password ?? '', body.name ?? 'Jugador');
        if (!result.ok) return json(400, { error: result.reason });
        const login = store.login(body.email ?? '', body.password ?? '', null);
        return json(201, login.ok ? { token: login.token, account: publicAccount(login.account) } : { error: login.reason });
      }

      if (url.pathname === '/api/auth/login' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req)) as { email?: string; password?: string; totpCode?: string };
        const result = store.login(body.email ?? '', body.password ?? '', body.totpCode ?? null);
        if (!result.ok) return json(401, { error: result.reason });
        return json(200, { token: result.token, account: publicAccount(result.account) });
      }

      if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
        const header = req.headers.authorization ?? '';
        if (header.startsWith('Bearer ')) store.logout(header.slice(7).trim());
        return json(200, { ok: true });
      }

      if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
        const field = url.searchParams.get('field') ?? 'kills';
        const allowed = ['kills', 'wins', 'matches', 'top5', 'rankedPoints', 'passXp'];
        if (!allowed.includes(field)) return json(400, { error: 'invalid-field' });
        return json(200, { field, entries: store.leaderboard(field as 'kills') });
      }

      const account = sessionAccount();
      if (!account) return json(401, { error: 'unauthorized' });

      if (url.pathname === '/api/profile' && req.method === 'GET') {
        return json(200, { account: publicAccount(account), clan: store.clanInfo(account), friends: store.friendNames(account) });
      }

      if (url.pathname === '/api/profile' && req.method === 'PATCH') {
        const body = JSON.parse(await readBody(req)) as { name?: string; avatarId?: string };
        const result = store.updateProfile(account, body);
        return json(result.ok ? 200 : 400, result.ok ? { account: publicAccount(account) } : { error: result.reason });
      }

      if (url.pathname === '/api/profile/totp' && req.method === 'POST') {
        return json(200, store.enableTotp(account));
      }

      if (url.pathname === '/api/profile/totp/confirm' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req)) as { code?: string };
        const ok = store.confirmTotp(account, body.code ?? '');
        return json(ok ? 200 : 400, ok ? { ok: true } : { error: 'totp-invalid' });
      }

      if (url.pathname === '/api/social/friend' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req)) as { name?: string };
        const result = store.addFriend(account, body.name ?? '');
        return json(result.ok ? 200 : 400, result);
      }

      if (url.pathname === '/api/social/friend' && req.method === 'DELETE') {
        const body = JSON.parse(await readBody(req)) as { id?: string };
        return json(200, { ok: store.removeFriend(account, body.id ?? '') });
      }

      if (url.pathname === '/api/social/clan' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req)) as { name?: string };
        const result = store.createClan(account, body.name ?? '');
        return json(result.ok ? 201 : 400, result);
      }

      if (url.pathname === '/api/social/clan' && req.method === 'PUT') {
        const body = JSON.parse(await readBody(req)) as { name?: string };
        const result = store.joinClan(account, body.name ?? '');
        return json(result.ok ? 200 : 400, result);
      }

      if (url.pathname === '/api/social/clan' && req.method === 'DELETE') {
        return json(200, store.leaveClan(account));
      }

      if (url.pathname === '/api/reports' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req)) as { reportedId?: string; reason?: string };
        if (!body.reportedId || !body.reason) return json(400, { error: 'reportedId-and-reason-required' });
        const report = store.fileReport(body.reportedId, account.id, body.reason);
        notifyOwner({ kind: 'report', reportedId: report.reportedId, reporterId: report.reporterId, reason: report.reason });
        return json(201, { ok: true, reportId: report.id });
      }

      if (url.pathname === '/api/redeem' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req)) as { code?: string };
        const result = store.redeem(account, body.code ?? '');
        if (result.ok) {
          const r = result.reward;
          const reward = [r.nx ? `${r.nx} NX` : null, r.dalos ? `${r.dalos} Dalos` : null].filter(Boolean).join(' + ') || 'premio';
          notifyOwner({ kind: 'redeem', code: body.code ?? '', accountId: account.id, reward });
        }
        return json(result.ok ? 200 : 400, result);
      }

      if (url.pathname === '/api/daily-login' && req.method === 'POST') {
        return json(200, store.claimDailyLogin(account));
      }

      json(404, { error: 'not-found' });
    } catch (err) {
      json(400, { error: err instanceof Error ? err.message : 'bad-request' });
    }
  })();
  return true;
};
