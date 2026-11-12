import http from 'node:http';
import type { EarningsService } from './earnings.js';

/**
 * Rutas del panel de ganancias del propietario:
 *   GET /admin                 → página HTML protegida por token
 *   GET /api/admin/earnings    → JSON protegido por token
 *
 * Autenticación: header `Authorization: Bearer <ADMIN_TOKEN>` o `?token=`.
 * Si ADMIN_TOKEN no está definido, el panel responde 503 (desactivado).
 */

export interface AdminRoutesDeps {
  earnings: EarningsService | null;
  adminToken: string | null;
}

const isAuthorized = (req: http.IncomingMessage, url: URL, token: string): boolean => {
  const header = req.headers.authorization ?? '';
  if (header === `Bearer ${token}`) return true;
  return url.searchParams.get('token') === token;
};

export const handleAdminRoutes = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  deps: AdminRoutesDeps,
): boolean => {
  const isAdminApi = url.pathname.startsWith('/api/admin');
  const isAdminPage = url.pathname === '/admin';
  if (!isAdminApi && !isAdminPage) return false;

  const json = (status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  if (isAdminPage && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(adminPageHtml());
    return true;
  }

  if (!deps.adminToken || !deps.earnings) {
    json(503, {
      error: 'admin-not-configured',
      msg: 'Define ADMIN_TOKEN en el entorno del servidor para activar el panel de ganancias.',
    });
    return true;
  }
  if (!isAuthorized(req, url, deps.adminToken)) {
    json(401, { error: 'unauthorized' });
    return true;
  }

  if (url.pathname === '/api/admin/earnings' && req.method === 'GET') {
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') ?? 30) || 30));
    void deps.earnings
      .summarize(days)
      .then((summary) => json(200, summary))
      .catch((err: Error) => json(500, { error: err.message }));
    return true;
  }

  json(404, { error: 'not-found' });
  return true;
};

export const mountAdminRoutes = (server: http.Server, deps: AdminRoutesDeps): void => {
  server.on('request', (req, res) => {
    handleAdminRoutes(req, res, new URL(req.url ?? '/', 'http://localhost'), deps);
  });
};

const adminPageHtml = (): string => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Nexo FPS — Panel de Ganancias</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: system-ui, sans-serif; background: radial-gradient(1200px 700px at 50% -10%, #16233a, #070b12); color: #e8eef7; min-height: 100vh; }
  header { text-align: center; padding: 40px 16px 12px; }
  h1 { margin: 0; font-size: 28px; letter-spacing: 2px; background: linear-gradient(90deg, #6cc4ff, #b07cff); -webkit-background-clip: text; background-clip: text; color: transparent; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 60px; }
  .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px; margin-bottom: 16px; }
  .total { font-size: 42px; font-weight: 800; color: #6cc4ff; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; }
  label { display: block; font-size: 13px; margin: 10px 0 4px; color: #9fb0c8; }
  input, button { width: 100%; box-sizing: border-box; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.3); color: inherit; font-size: 14px; }
  button { background: linear-gradient(90deg, #2f7fd6, #7a4fd6); border: none; font-weight: 700; cursor: pointer; margin-top: 12px; }
  .muted { color: #9fb0c8; font-size: 13px; }
</style>
</head>
<body>
<header><h1>NEXO FPS · PANEL DE GANANCIAS</h1><p class="muted">Ingresos de PayPal del servidor</p></header>
<main>
  <div class="card">
    <label>Token de administrador (ADMIN_TOKEN)</label>
    <input id="token" type="password" placeholder="Token del servidor" />
    <label>Días a consultar</label>
    <input id="days" type="number" value="30" min="1" max="365" />
    <button id="refresh">Consultar ganancias</button>
  </div>
  <div class="card" id="result"><p class="muted">Introduce el token y consulta.</p></div>
</main>
<script>
  const btn = document.getElementById('refresh');
  btn.addEventListener('click', async () => {
    const token = document.getElementById('token').value.trim();
    const days = document.getElementById('days').value || '30';
    const out = document.getElementById('result');
    out.innerHTML = '<p class="muted">Consultando…</p>';
    try {
      const res = await fetch('/api/admin/earnings?days=' + encodeURIComponent(days), {
        headers: { authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      if (!res.ok) { out.innerHTML = '<p class="muted">Error: ' + (data.error || res.status) + '</p>'; return; }
      const rows = (data.perSku || []).map((r) =>
        '<tr><td>' + r.sku + '</td><td>' + r.count + '</td><td>$' + r.amountUsd.toFixed(2) + '</td></tr>').join('');
      out.innerHTML =
        '<p class="muted">Fuente: ' + data.source + ' · Capturas locales de esta sesión: ' + data.localCaptured + '</p>' +
        '<p class="total">$' + data.totalUsd.toFixed(2) + ' USD</p>' +
        '<p class="muted">' + data.transactionCount + ' transacciones en ' + days + ' días</p>' +
        (rows ? '<table><tr><th>Artículo</th><th>Ventas</th><th>Total</th></tr>' + rows + '</table>' : '');
    } catch (e) {
      out.innerHTML = '<p class="muted">Fallo de red: ' + e + '</p>';
    }
  });
</script>
</body>
</html>`;
