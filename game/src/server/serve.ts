import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = Number(process.env.NEXO_HTTP_PORT ?? 8080);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/**
 * Sirve archivos estáticos del cliente (game/client y game/dist/client).
 * Devuelve true si la petición fue atendida. Bloquea path traversal.
 */
export const handleStatic = (req: http.IncomingMessage, res: http.ServerResponse, url: URL): boolean => {
  const rel = url.pathname === '/' ? '/client/index.html' : url.pathname;
  const filePath = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('forbidden');
    return true;
  }
  if (!filePath.startsWith(path.join(ROOT, 'client')) && !filePath.startsWith(path.join(ROOT, 'dist'))) {
    return false;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream',
    });
    res.end(data);
  });
  return true;
};

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const server = http.createServer((req, res) => {
    handleStatic(req, res, new URL(req.url ?? '/', 'http://localhost'));
  });
  server.listen(PORT, () => {
    console.log(`[nexo] client served at http://localhost:${PORT}`);
  });
}
