/**
 * Build de archivo único: genera dist/nexofps-standalone.html con todo
 * (JS, CSS y logo) incrustado. Se puede abrir con doble clic en
 * Windows/macOS/Linux sin instalar nada — el modo Entrenamiento corre
 * la simulación autoritativa completa en el navegador.
 *
 * Uso: npm run bundle
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const clientDir = path.join(root, 'client');
const outPath = path.join(root, 'dist', 'nexofps-standalone.html');

const bundleTmp = path.join(root, 'dist', 'client-bundle.tmp.js');
execSync(
  `npx esbuild ${path.join(root, 'src/client/main.ts')} --bundle --format=iife ` +
    `--outfile=${bundleTmp} --define:process.env.NODE_ENV='"production"' --log-level=warning`,
  { cwd: root, stdio: 'inherit' },
);

const js = fs.readFileSync(bundleTmp, 'utf8');
fs.rmSync(bundleTmp);

let html = fs.readFileSync(path.join(clientDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(clientDir, 'styles.css'), 'utf8');
const logoSvg = fs.readFileSync(path.join(clientDir, 'logo.svg'));

const logoDataUri = `data:image/svg+xml;base64,${logoSvg.toString('base64')}`;
html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${logoDataUri}" />`);
html = html.replaceAll('src="/client/logo.svg"', `src="${logoDataUri}"`);
html = html.replace(
  /<link rel="stylesheet" href="\/client\/styles\.css" \/>/,
  `<style>\n${css}\n</style>`,
);
html = html.replace(
  /<script type="module" src="\/dist\/client\/main\.js"><\/script>/,
  `<script>\n${js}\n</script>`,
);

if (
  html.includes('type="module"') ||
  html.includes('rel="stylesheet"') ||
  html.includes('src="/client/logo.svg"')
) {
  throw new Error('quedan referencias externas en el HTML standalone');
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);
console.log(`[nexo] standalone: ${outPath} (${Math.round(html.length / 1024)} KB)`);
