import { GAME_NAME, GAME_VERSION } from '../shared/version.js';

export type DownloadPlatform = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'web' | 'servidor';

export const DOWNLOAD_PLATFORMS: DownloadPlatform[] = [
  'windows',
  'macos',
  'linux',
  'android',
  'ios',
  'web',
  'servidor',
];

export const isDownloadPlatform = (value: string): value is DownloadPlatform =>
  (DOWNLOAD_PLATFORMS as string[]).includes(value);

const REPO_RAW =
  'https://github.com/tiotoni838-prog/Nexo/raw/vibe/nexo-frontier-vertical-slice-951e24/releases';

interface PlatformSpec {
  title: string;
  icon: string;
  status: 'ready' | 'generated' | 'store';
  file?: string;
  steps: string[];
  note: string;
}

const PLATFORM_SPECS: Record<DownloadPlatform, PlatformSpec> = {
  windows: {
    title: 'Windows',
    icon: '🪟',
    status: 'ready',
    file: `${REPO_RAW}/NexoFPS-${GAME_VERSION}-windows-x64.zip`,
    steps: [
      'Pulsa el botón de descarga y guarda el ZIP.',
      'Clic derecho sobre el ZIP → «Extraer todo…».',
      'Abre la carpeta extraída y ejecuta <b>nexo-fps.exe</b>.',
      'Si Windows SmartScreen avisa, pulsa «Más información» → «Ejecutar de todas formas».',
    ],
    note: 'Aplicación nativa (Electron 33). No abre navegador: es una ventana propia.',
  },
  macos: {
    title: 'macOS',
    icon: '🍎',
    status: 'generated',
    steps: [
      'Descarga el repositorio o clónalo: <code>git clone https://github.com/tiotoni838-prog/Nexo</code>.',
      'Instala Node.js 20+ y ejecuta dentro de <code>game/</code>: <code>npm install &amp;&amp; npm run desktop</code>.',
      'Al terminar, la app queda en <code>game/dist-desktop/NexoFPS-darwin-x64</code> (Intel) y <code>-arm64</code> (Apple Silicon).',
      'Abre <code>nexo-fps.app</code>; si macOS bloquea la app sin firmar: clic derecho → «Abrir».',
    ],
    note: 'No se aloja en GitHub porque supera los 100 MB por archivo; se genera localmente en minutos.',
  },
  linux: {
    title: 'Linux',
    icon: '🐧',
    status: 'ready',
    file: `${REPO_RAW}/NexoFPS-${GAME_VERSION}-linux-x64.zip`,
    steps: [
      'Descarga el ZIP con tu navegador o <code>wget</code>.',
      'Descomprime: <code>unzip NexoFPS-*.zip</code>.',
      'Da permiso de ejecución si hace falta: <code>chmod +x nexo-fps</code>.',
      'Ejecuta: <code>./nexo-fps</code>.',
    ],
    note: 'Aplicación nativa (Electron 33) para x64; probado en glibc estándar.',
  },
  android: {
    title: 'Android (APK)',
    icon: '🤖',
    status: 'ready',
    file: `${REPO_RAW}/NexoFPS-${GAME_VERSION}-android.apk`,
    steps: [
      'Descarga el APK directamente en tu teléfono con el botón de arriba.',
      'Si tu navegador avisa, permite «Instalar apps desconocidas» para Nexo FPS (solo la primera vez).',
      'Abre el APK descargado y pulsa <b>Instalar</b>.',
      'Abre «Nexo FPS» desde el cajón de aplicaciones: pantalla completa y controles táctiles.',
      'Para jugar online, conéctate al servidor de tu host (WebSocket) desde el menú Unirse.',
    ],
    note: 'APK firmada (minSdk 21, Android 5.0+). Cuando el propietario active la cuenta de desarrollador de Play Store (25 USD una vez), la descarga oficial será desde la tienda y esta página lo enlazará.',
  },
  ios: {
    title: 'iOS / iPhone',
    icon: '📱',
    status: 'store',
    steps: [
      'Los iPhone solo instalan apps firmadas: se necesita un Mac con Xcode.',
      'Instala <a href="https://developer.apple.com/xcode/">Xcode</a> y abre el proyecto WebView de <code>game/ios/</code>.',
      'Conecta el iPhone, selecciona tu dispositivo y pulsa <b>Run</b>.',
      'Para distribuir fuera de tu hogar se requiere la cuenta de desarrollador Apple (99 USD/año) y TestFlight o App Store.',
    ],
    note: 'Cuando el propietario active la App Store, la descarga oficial será desde la tienda y esta página lo enlazará.',
  },
  web: {
    title: 'Un solo archivo (todas las plataformas)',
    icon: '🎮',
    status: 'ready',
    file: `${REPO_RAW}/NexoFPS-${GAME_VERSION}-web-standalone.zip`,
    steps: [
      'Descarga el ZIP y descomprímelo.',
      'Abre <b>NexoFPS.html</b> con doble clic (Chrome, Edge o Firefox).',
      'El modo Entrenamiento funciona sin internet; para online ejecuta el servidor.',
      'En el teléfono: abre la página del servidor y pulsa ⛶ pantalla completa.',
    ],
    note: 'Ideal para probar el juego al instante en cualquier equipo.',
  },
  servidor: {
    title: 'Servidor online',
    icon: '🖥️',
    status: 'ready',
    file: `${REPO_RAW}/NexoFPS-${GAME_VERSION}-servidor.zip`,
    steps: [
      'Instala Node.js 20 o superior.',
      'Descomprime el ZIP y dentro de la carpeta ejecuta <code>npm install</code>.',
      'Copia <code>.env.example</code> a <code>.env</code> y rellena tus credenciales PayPal y Telegram.',
      'Arranca con <code>npm start</code>; el juego queda en el puerto 8080.',
    ],
    note: 'Incluye tienda PayPal, panel de ganancias /admin, cuentas con 2FA, clanes, rankings y avisos Telegram al propietario.',
  },
};

const STATUS_BADGE: Record<PlatformSpec['status'], string> = {
  ready: '✅ Disponible',
  generated: '🛠️ Se genera localmente',
  store: '🏪 Requiere cuenta de tienda',
};

const esc = (s: string): string =>
  s.replace(/&(?!(amp|lt|gt|#|nbsp);)/g, '&amp;').replace(/<(?!\/?(b|code|a|br)\b)/g, '&lt;');

export const renderDownloadPage = (platform: DownloadPlatform, origin: string): string => {
  const spec = PLATFORM_SPECS[platform];
  const cards = DOWNLOAD_PLATFORMS.filter((p) => p !== platform)
    .map(
      (p) =>
        `<a class="chip" href="/download/${p}">${PLATFORM_SPECS[p].icon} ${esc(PLATFORM_SPECS[p].title)}</a>`,
    )
    .join('\n    ');
  const cta = spec.file
    ? `<a class="btn" href="${spec.file}">⬇️ Descargar para ${esc(spec.title)}</a>`
    : `<div class="btn ghost">${STATUS_BADGE[spec.status]}</div>`;
  const steps = spec.steps.map((s) => `<li>${s}</li>`).join('\n      ');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Nexo FPS — Descargar para ${esc(spec.title)}</title>
<link rel="icon" type="image/svg+xml" href="/client/logo.svg" />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { min-height: 100vh; display: flex; flex-direction: column; align-items: center;
    font-family: system-ui, sans-serif; padding: 32px 20px;
    background: radial-gradient(1200px 700px at 50% -10%, #16233f 0%, #070b14 60%); color: #e8eefc; }
  img[alt="Nexo FPS"] { width: 84px; height: 84px; }
  h1 { letter-spacing: 4px; margin-top: 8px; font-size: 26px; }
  .badge { margin-top: 8px; color: #38e1c8; font-size: 14px; }
  .card { max-width: 640px; width: 100%; margin-top: 22px; padding: 24px;
    border: 1px solid rgba(120,150,220,0.25); border-radius: 16px; background: rgba(20,30,55,0.6); }
  .card h2 { font-size: 20px; margin-bottom: 12px; }
  ol { margin: 0 0 14px 20px; line-height: 1.9; font-size: 14px; color: #c6d2ea; }
  code { background: rgba(56,225,200,0.12); padding: 1px 6px; border-radius: 6px; font-size: 13px; }
  .btn { display: block; text-align: center; margin-top: 6px; padding: 14px; border-radius: 12px;
    background: #38e1c8; color: #04121c; font-weight: 800; text-decoration: none; font-size: 16px; }
  .btn.ghost { background: rgba(120,150,220,0.15); color: #8ea0c0; cursor: default; }
  .note { max-width: 640px; margin-top: 16px; color: #8ea0c0; font-size: 13px; line-height: 1.6; text-align: center; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 22px; max-width: 640px; }
  .chip { padding: 8px 14px; border: 1px solid rgba(120,150,220,0.3); border-radius: 999px;
    color: #c6d2ea; text-decoration: none; font-size: 13px; }
  .chip:hover { border-color: rgba(56,225,200,0.7); color: #e8eefc; }
</style>
</head>
<body>
  <img src="/client/logo.svg" alt="Nexo FPS" />
  <h1>NEXO FPS</h1>
  <p class="badge">v${GAME_VERSION} · ${STATUS_BADGE[spec.status]}</p>
  <div class="card">
    <h2>${spec.icon} Cómo descargar y jugar en ${esc(spec.title)}</h2>
    <ol>
      ${steps}
    </ol>
    ${cta}
  </div>
  <p class="note">${spec.note}</p>
  <div class="chips">
    ${cards}
  </div>
</body>
</html>
`;
};

export const downloadPagePath = (pathname: string): DownloadPlatform | null => {
  const match = /^\/download\/([a-z]+)$/.exec(pathname);
  const id = match?.[1];
  if (!id || !isDownloadPlatform(id)) return null;
  return id;
};
