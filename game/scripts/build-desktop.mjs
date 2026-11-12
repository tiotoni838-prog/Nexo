/**
 * Empaqueta el juego como apps de escritorio nativas (Electron precompilado):
 *   Windows x64 (.exe), Linux x64, macOS x64 + arm64.
 * Cada build incluye el standalone HTML completo (entrenamiento offline y
 * conexión por WebSocket/P2P a servidores).
 *
 * Uso: npm run desktop
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'dist-desktop');
const appDir = path.join(outDir, 'app');
const html = path.join(root, 'dist', 'nexofps-standalone.html');

if (!fs.existsSync(html)) {
  console.error('[nexo] falta dist/nexofps-standalone.html — ejecuta primero: npm run bundle');
  process.exit(1);
}

fs.rmSync(appDir, { recursive: true, force: true });
fs.mkdirSync(appDir, { recursive: true });
fs.copyFileSync(path.join(root, 'electron', 'main.js'), path.join(appDir, 'main.js'));
fs.copyFileSync(path.join(root, 'electron', 'package.json'), path.join(appDir, 'package.json'));
fs.copyFileSync(html, path.join(appDir, 'nexofps.html'));

const targets = [
  { platform: 'win32', arch: 'x64' },
  { platform: 'linux', arch: 'x64' },
  { platform: 'darwin', arch: 'x64' },
  { platform: 'darwin', arch: 'arm64' },
];

for (const { platform, arch } of targets) {
  console.log(`[nexo] empaquetando ${platform}-${arch}…`);
  execSync(
    `npx @electron/packager . NexoFPS --platform=${platform} --arch=${arch} ` +
      `--electron-version=33.2.0 --out=${outDir} --app-bundle-id=com.nexo.fps --overwrite --download.cache=${outDir}/cache`,
    { cwd: appDir, stdio: 'inherit' },
  );
}
console.log('[nexo] escritorio listo en dist-desktop/');
