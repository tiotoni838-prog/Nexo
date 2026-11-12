import { GameServer, type Connection } from '../server/gameServer.js';
import { WsTransport, ClientNet, type Transport } from './net.js';
import { P2PHost, P2PGuest } from './p2p.js';
import { Renderer, type RenderState } from './render.js';
import { Sfx } from './audio.js';
import {
  loadSettings,
  saveSettings,
  applySettingsToDom,
  applyI18n,
  keyLabel,
  QUALITY_DPR_CAP,
  QUALITY_PARTICLES,
  type Settings,
} from './settings.js';
import { initAuthScreen } from './auth.js';
import { GAME_MODES, isGameModeId, type GameModeId } from '../shared/gameModes.js';
import { damageAngle, gridLabel } from '../shared/graphics.js';
import { WORLD_RADIUS } from '../shared/constants.js';
import { t } from '../shared/i18n.js';
import { WEAPONS } from '../shared/weapons.js';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from '../shared/characters.js';
import { GAME_VERSION } from '../shared/version.js';
import {
  initMetaPanels,
  processPurchaseReturn,
  grantMatchRewards,
  addNx,
  getNx,
  renderMeta,
} from './meta.js';
import type { ClientMsg, ServerMsg, SnapshotMsg, WelcomeMsg } from '../shared/protocol.js';

type Mode = 'menu' | 'solo' | 'ws' | 'p2p-host' | 'p2p-guest';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;
const $input = (id: string): HTMLInputElement => document.getElementById(id) as HTMLInputElement;

const settings: Settings = loadSettings();
applySettingsToDom(settings);
applyI18n(settings);

let mode: Mode = 'menu';
let net: ClientNet | null = null;
let localServer: GameServer | null = null;
let yourId = -1;
let latestSnapshot: SnapshotMsg | null = null;
let gameMap: WelcomeMsg['map'] | null = null;
let prevPositions = new Map<number, { x: number; y: number }>();
let mouseAim = 0;
let firing = false;
let slideQueued = false;
let proneToggle = false;
let selectedCharacter: CharacterId = 'aurora';
let selectedMode: GameModeId = 'solo';
let killFeedTimers: number[] = [];

const refreshNxBalanceUi = (): void => {
  renderMeta();
};
refreshNxBalanceUi();
initMetaPanels();
processPurchaseReturn();

$('btnFullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
});

if ('ontouchstart' in window) {
  const hint = document.createElement('p');
  hint.className = 'muted';
  hint.style.textAlign = 'center';
  hint.textContent = '📱 En teléfono usa los controles táctiles en partida y activa pantalla completa.';
  $('panel-jugar')!.querySelector('.menu-card')!.prepend(hint);
}

const checkForUpdates = async (): Promise<void> => {
  try {
    const res = await fetch('/api/version');
    if (!res.ok) return;
    const data = (await res.json()) as { version: string };
    if (data.version !== GAME_VERSION) {
      $('updateText').textContent = `Nueva versión disponible: ${data.version} (tienes ${GAME_VERSION})`;
      $('updateBanner').classList.remove('hidden');
    }
  } catch {
    /* sin servidor: nada que comprobar */
  }
};
$('btnUpdate').addEventListener('click', () => {
  location.reload();
});
void checkForUpdates();

const renderer = new Renderer($('canvas') as HTMLCanvasElement);
const sfx = new Sfx();
let spectateId: number | undefined;

const applyRenderQuality = (): void => {
  renderer.setQuality(QUALITY_DPR_CAP[settings.quality], settings.shadows, settings.brightness);
  renderer.particles.setMaxParticles(QUALITY_PARTICLES[settings.quality]);
  renderer.setStyle(settings.filter, settings.reduceEffects, settings.colorblind);
  sfx.setVolumes(settings.volMaster, settings.volMusic, settings.volSfx);
};
applyRenderQuality();

const showScreen = (id: 'menu' | 'settings' | 'game'): void => {
  for (const s of ['menu', 'settings', 'game']) {
    $(`#${s}`).classList.toggle('hidden', s !== id);
  }
};

const ensureNet = (transport: Transport): ClientNet => {
  const handlers = {
    onWelcome: (msg: WelcomeMsg) => {
      yourId = msg.yourId;
      gameMap = msg.map;
      transport.send({ t: 'hello', protocol: 2, name: playerName(), lang: settings.lang, characterId: selectedCharacter });
    },
    onSnapshot: (msg: SnapshotMsg) => {
      for (const p of msg.players) {
        const prev = prevPositions.get(p.id);
        if (prev) {
          prev.x = p.x;
          prev.y = p.y;
        } else {
          prevPositions.set(p.id, { x: p.x, y: p.y });
        }
      }
      latestSnapshot = msg;
      net?.onSnapshot(msg);
      updateHud(msg);
    },
    onServerMsg: (msg: ServerMsg) => handleServerMsg(msg),
    onDisconnect: () => {
      banner(t('disconnected', settings.lang));
      setTimeout(() => {
        stopGame();
        showScreen('menu');
      }, 1500);
    },
  };
  return new ClientNet(transport);
};

const playerName = (): string => $input('playerName').value.trim() || 'Jugador';

class LocalTransport implements Transport {
  constructor(
    private server: GameServer,
    private connId: number,
  ) {}
  send(msg: ClientMsg): void {
    this.server.handleRawMessage(this.connId, msg, performance.now());
  }
  close(): void {
    this.server.removeConnection(this.connId);
  }
}

const startLocalServer = (botCount: number, online: boolean): GameServer => {
  const server = new GameServer({
    mode: online ? 'online' : 'solo-bots',
    botCount,
    minPlayersToStart: online ? 2 : 1,
    autoStartLobbyMs: online ? 8000 : 500,
    modeId: selectedMode,
  });
  const connId = 1;
  const connection: Connection = {
    id: connId,
    send: (msg) => routeServerMsg(msg),
    close: () => {},
  };
  server.addConnection(connection);
  return server;
};

const routeServerMsg = (msg: ServerMsg): void => {
  if (msg.t === 'welcome') {
    yourId = msg.yourId;
    gameMap = msg.map;
    $('mapName').textContent = msg.map?.nameEs ?? '';
  } else if (msg.t === 'snapshot') {
    latestSnapshot = msg;
    updateHud(msg);
  } else {
    handleServerMsg(msg);
  }
};

const startSolo = (): void => {
  mode = 'solo';
  localServer = startLocalServer(11, false);
  net = ensureNet(new LocalTransport(localServer, 1));
  net.sendHello(playerName(), settings.lang, selectedCharacter);
  showScreen('game');
  renderer.resize();
};

const startWs = async (): Promise<void> => {
  const addr = $input('serverAddr').value.trim();
  mode = 'ws';
  const transport = new WsTransport();
  try {
    await transport.connect(addr, {
      onWelcome: (msg) => {
        yourId = msg.yourId;
        gameMap = msg.map;
      },
      onSnapshot: (msg) => {
        latestSnapshot = msg;
        net?.onSnapshot(msg);
        updateHud(msg);
      },
      onServerMsg: handleServerMsg,
      onDisconnect: () => {
        banner(t('disconnected', settings.lang));
        setTimeout(() => {
          stopGame();
          showScreen('menu');
        }, 1500);
      },
    });
  } catch {
    banner(t('disconnected', settings.lang));
    return;
  }
  net = new ClientNet(transport);
  net.sendHello(playerName(), settings.lang, selectedCharacter);
  showScreen('game');
  renderer.resize();
};

const p2pHost = new P2PHost();
const p2pGuest = new P2PGuest();

const startP2pHost = async (): Promise<void> => {
  mode = 'p2p-host';
  localServer = startLocalServer(0, true);
  net = ensureNet(new LocalTransport(localServer, 1));
  net.sendHello(playerName(), settings.lang, selectedCharacter);
  showScreen('game');
  renderer.resize();
  const offer = await p2pHost.createOffer();
  $input('offerOut').value = offer;
  banner('Esperando respuesta del invitado… / Waiting for guest answer…');
};

const startP2pGuest = async (): Promise<void> => {
  const code = $input('offerIn').value.trim();
  if (!code) return;
  mode = 'p2p-guest';
  const transport: Transport = {
    send: (msg) => p2pGuest.send(msg),
    close: () => p2pGuest.close(),
  };
  net = new ClientNet(transport);
  try {
    const answer = await p2pGuest.join(code, (msg) => routeServerMsg(msg));
    $input('answerOut').value = answer;
    showScreen('game');
    renderer.resize();
    net.sendHello(playerName(), settings.lang, selectedCharacter);
    banner('P2P: espera a que el anfitrión acepte tu respuesta');
  } catch {
    banner('Código de invitación inválido / Invalid invite code');
    mode = 'menu';
  }
};

const stopGame = (): void => {
  net?.transport.close();
  net = null;
  localServer = null;
  latestSnapshot = null;
  gameMap = null;
  prevPositions.clear();
  killFeedTimers.forEach((id) => clearTimeout(id));
  killFeedTimers = [];
  mode = 'menu';
};

const banner = (text: string, ms = 2500): void => {
  const el = $('banner');
  el.textContent = text;
  el.classList.remove('hidden');
  window.setTimeout(() => el.classList.add('hidden'), ms);
};

const subtitle = (text: string): void => {
  if (!settings.subtitles) return;
  const el = $('subtitleBar');
  el.textContent = text;
  el.classList.remove('hidden');
  window.setTimeout(() => el.classList.add('hidden'), 1800);
};

const addKillFeed = (text: string): void => {
  const el = document.createElement('div');
  el.textContent = text;
  $('killfeed').appendChild(el);
  const timer = window.setTimeout(() => el.remove(), 6000);
  killFeedTimers.push(timer);
};

const handleServerMsg = (msg: ServerMsg): void => {
  switch (msg.t) {
    case 'phase':
      if (msg.phase === 'drop') banner(t('chooseDrop', settings.lang), 4000);
      if (msg.phase === 'over' && msg.winnerName) {
        banner(`${t('victory', settings.lang)} — ${msg.winnerName}`, 4000);
      }
      break;
    case 'event':
      if (msg.kind === 'hit' && msg.victimId === yourId && settings.damageIndicators) {
        showDamageDirection(msg.x, msg.y);
      }
      if (msg.kind === 'hit' && msg.victimId === yourId) {
        $('hud').classList.add('hurt');
        window.setTimeout(() => $('hud').classList.remove('hurt'), 450);
        sfx.hurt();
      }
      if (msg.kind === 'kill' && typeof msg.killerName === 'string' && typeof msg.victimName === 'string') {
        addKillFeed(`☠ ${msg.killerName} → ${msg.victimName}`);
        subtitle(`${msg.killerName} eliminó a ${msg.victimName}`);
      }
      if (msg.kind === 'shot' && msg.playerId !== yourId) subtitle('Disparo cercano / Nearby shot');
      if (msg.kind === 'pickup' && msg.playerId === yourId) subtitle('Objeto recogido / Item picked up');
      if (msg.kind === 'ability') {
        const label = msg.abilityId ? ABILITY_LABELS[msg.abilityId] : undefined;
        const abilityName = label ? label[settings.lang] : t('ability', settings.lang);
        const who = msg.playerId === yourId ? '' : `${whoName(msg.playerId)}: `;
        subtitle(`${who}${abilityName}`);
        if (msg.abilityId === 'muro' && typeof msg.x === 'number' && typeof msg.y === 'number') {
          renderer.particles.ring(msg.x, msg.y, 60, 420, 'rgba(125, 232, 255, 0.9)');
        }
        if (msg.playerId === yourId) sfx.pickup();
      }
      break;
    case 'result': {
      const panel = $('resultPanel');
      const won = msg.placement === 1;
      if (won) sfx.victory();
      else sfx.defeat();
      const rewards = grantMatchRewards(msg.kills, msg.placement, msg.totalPlayers, selectedCharacter);
      refreshNxBalanceUi();
      const claimedText = rewards.claimed.length
        ? `<p class="nx-balance">🎖️ ${rewards.claimed.map((r) => r.labelEs).join(' · ')}</p>`
        : '';
      panel.innerHTML = `
        <h2>${won ? t('victory', settings.lang) : t('defeat', settings.lang)}</h2>
        <p>${t('placement', settings.lang)}: ${msg.placement} / ${msg.totalPlayers}</p>
        <p>${t('kills', settings.lang)}: ${msg.kills}</p>
        <p class="nx-balance">◆ +${rewards.nx} NX · Total: ${rewards.totalNx} NX · +${rewards.passXp} XP de pase</p>
        ${claimedText}
        <p>🏆 ${msg.winnerName}</p>
        <button class="btn" id="btnBackMenu">${t('backToMenu', settings.lang)}</button>`;
      panel.classList.remove('hidden');
      $('btnBackMenu').addEventListener('click', () => {
        stopGame();
        showScreen('menu');
      });
      break;
    }
    case 'error':
      if (msg.code === 'version-mismatch') banner(t('versionMismatch', settings.lang), 4000);
      else banner(`${msg.code}: ${msg.msg}`, 3000);
      break;
    default:
      break;
  }
};

const showDamageDirection = (fromX?: number, fromY?: number): void => {
  if (fromX === undefined || fromY === undefined) return;
  const me = latestSnapshot?.players.find((p) => p.id === yourId);
  if (!me) return;
  const angle = damageAngle(fromX, fromY, me.x, me.y, me.aim);
  const arrow = document.createElement('div');
  arrow.className = 'dmg-arrow';
  arrow.textContent = '▲';
  arrow.style.transform = `rotate(${angle}rad) translate(0, -120px)`;
  $('damageArrows').appendChild(arrow);
  window.setTimeout(() => arrow.remove(), 1500);
};

const renderCompass = (aim: number): void => {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const deg = ((-aim * 180) / Math.PI + 360) % 360;
  const idx = Math.round(deg / 45) % 8;
  $('compassStrip').textContent = `← ${dirs[(idx + 7) % 8]} · [${dirs[idx]}] · ${dirs[(idx + 1) % 8]} →`;
};

const whoName = (playerId?: number): string =>
  latestSnapshot?.players.find((p) => p.id === playerId)?.name ?? '?';

const ABILITY_LABELS: Record<string, { es: string; en: string }> = Object.fromEntries(
  CHARACTER_IDS.map((id) => [CHARACTERS[id].ability.id, { es: CHARACTERS[id].ability.nameEs, en: CHARACTERS[id].ability.nameEn }]),
);

const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const updateHud = (snap: SnapshotMsg): void => {
  const you = snap.players.find((p) => p.id === yourId);
  const aliveSelf = snap.you;

  $('aliveCount').textContent = `${t('alive', settings.lang)}: ${snap.alive}`;
  if (you) {
    $('gridCoords').textContent = gridLabel(you.x, you.y, WORLD_RADIUS);
    renderCompass(you.aim);
  }

  if (snap.phase === 'drop') {
    $('zoneTimer').textContent = t('chooseDrop', settings.lang);
  } else if (snap.zoneMode === 'shrink') {
    $('zoneTimer').textContent = `⚠ ${t('zoneShrinking', settings.lang)} ${fmtTime(snap.zoneTimerMs)}`;
  } else {
    $('zoneTimer').textContent = `${t('zoneClosingSoon', settings.lang)}: ${fmtTime(snap.zoneTimerMs)}`;
  }

  if (aliveSelf) {
    ($('hpBar') as HTMLElement).style.width = `${Math.max(0, aliveSelf.hp)}%`;
    ($('shieldBar') as HTMLElement).style.width = `${Math.max(0, aliveSelf.shield)}%`;
    $('hpText').textContent = `${Math.max(0, Math.round(aliveSelf.hp))}`;
    $('shieldText').textContent = `${Math.max(0, Math.round(aliveSelf.shield))}`;

    const weapon = aliveSelf.weapons[aliveSelf.activeSlot];
    const weaponName = weapon ? WEAPONS[weapon.weaponId][settings.lang === 'en' ? 'nameEn' : 'nameEs'] : '—';
    $('weaponInfo').textContent = `${weaponName} · ${aliveSelf.mag}/${aliveSelf.ammo}${aliveSelf.reloading ? ' ⟳' : ''}`;

    const abilityEl = $('abilityInfo');
    const charDef = CHARACTERS[aliveSelf.characterId];
    if (charDef) {
      const abilityName = charDef.ability[settings.lang === 'en' ? 'nameEn' : 'nameEs'];
      const cd = aliveSelf.abilityCooldownMs;
      abilityEl.textContent = cd > 0 ? `${abilityName}: ${fmtTime(cd)}` : `${abilityName} ✓`;
      abilityEl.classList.toggle('ready', cd === 0);
    }

    const inv = $('inventoryBar');
    inv.innerHTML = '';
    aliveSelf.weapons.forEach((w, i) => {
      const slot = document.createElement('div');
      slot.className = `slot${i === aliveSelf.activeSlot ? ' active' : ''}`;
      const label = w ? WEAPONS[w.weaponId][settings.lang === 'en' ? 'nameEn' : 'nameEs'] : '—';
      slot.innerHTML = `<span>${i + 1}</span><span class="item-label">${label}</span>`;
      inv.appendChild(slot);
    });
    for (const [count, cls] of [
      [aliveSelf.botiquines, '＋'],
      [aliveSelf.escudos, '◈'],
    ] as Array<[number, string]>) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.textContent = `${cls} ${count}`;
      inv.appendChild(slot);
    }
  }

  if (you && !you.alive && snap.phase === 'play') {
    subtitle(t('spectator', settings.lang));
  }
  if (you && you.alive && snap.zoneMode !== 'closed') {
    const dx = you.x - snap.zone.cx;
    const dy = you.y - snap.zone.cy;
    if (dx * dx + dy * dy > snap.zone.r * snap.zone.r) {
      subtitle(t('outsideZone', settings.lang));
    }
  }
};

// ---------- Input ----------
const keysDown = new Set<string>();

const keyFor = (action: string): string => settings.keys[action] ?? '';

window.addEventListener('keydown', (ev) => {
  if (mode === 'menu') return;
  keysDown.add(ev.code);
  if (ev.code === keyFor('pickup')) net?.sendAction({ t: 'action', kind: 'pickup' });
  if (ev.code === keyFor('reload')) net?.sendAction({ t: 'action', kind: 'reload' });
  if (ev.code === keyFor('heal')) net?.sendAction({ t: 'action', kind: 'use', consumable: 'botiquin' });
  if (ev.code === keyFor('shieldItem')) net?.sendAction({ t: 'action', kind: 'use', consumable: 'escudo' });
  if (ev.code === keyFor('swap')) net?.sendAction({ t: 'action', kind: 'swap', slot: latestSnapshot?.you ? 1 - latestSnapshot.you.activeSlot : 0 });
  if (ev.code === keyFor('grenade')) net?.sendAction({ t: 'action', kind: 'throwGrenade' });
  if (ev.code === keyFor('ability')) net?.sendAction({ t: 'action', kind: 'ability' });
  if (ev.code === keyFor('slide')) slideQueued = true;
  if (ev.code === keyFor('reload')) sfx.reload();
});

window.addEventListener('keyup', (ev) => keysDown.delete(ev.code));

const canvasEl = $('canvas') as HTMLCanvasElement;

canvasEl.addEventListener('mousemove', (ev) => {
  const rect = canvasEl.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  mouseAim = Math.atan2(ev.clientY - rect.top - cy, ev.clientX - rect.left - cx) * settings.sensitivity;
});

canvasEl.addEventListener('mousedown', (ev) => {
  if (ev.button !== 0) return;
  const me = latestSnapshot?.players.find((p) => p.id === yourId);
  if (latestSnapshot?.phase === 'drop') {
    sendDropChoiceFromClick(ev.clientX, ev.clientY);
    return;
  }
  if (me && !me.alive && latestSnapshot) {
    const alive = latestSnapshot.players.filter((p) => p.alive && !p.landing);
    if (alive.length > 0) {
      const idx = alive.findIndex((p) => p.id === spectateId);
      spectateId = alive[(idx + 1) % alive.length]!.id;
      subtitle(`Espectador \u2192 ${alive.find((p) => p.id === spectateId)!.name}`);
    }
    return;
  }
  firing = true;
});
window.addEventListener('mouseup', () => {
  firing = false;
});

const screenToWorld = (clientX: number, clientY: number): { x: number; y: number } | null => {
  if (!latestSnapshot || !gameMap) return null;
  const focus =
    latestSnapshot.players.find((p) => p.id === yourId) ??
    latestSnapshot.players.find((p) => p.alive) ??
    null;
  if (!focus) return null;
  const rect = canvasEl.getBoundingClientRect();
  const zoom = Math.min(canvasEl.width, canvasEl.height) / (900 * renderer['dpr']) * renderer['dpr'];
  const scale = rect.width / canvasEl.width;
  const wx = (clientX - rect.left - rect.width / 2) / (zoom * scale) + focus.x;
  const wy = (clientY - rect.top - rect.height / 2) / (zoom * scale) + focus.y;
  return { x: wx, y: wy };
};

const sendDropChoiceFromClick = (clientX: number, clientY: number): void => {
  const world = screenToWorld(clientX, clientY);
  if (world) net?.sendDropChoice(world.x, world.y);
};

// Táctil
let joyActive = false;
let joyVec = { x: 0, y: 0 };
const joyBase = $('joyBase');
const joyStick = $('joyStick');

const isTouchDevice = 'ontouchstart' in window;

const joyHandler = (ev: TouchEvent): void => {
  const touch = ev.touches[0];
  if (!touch) return;
  const rect = joyBase.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = touch.clientX - cx;
  const dy = touch.clientY - cy;
  const max = rect.width / 2;
  const len = Math.hypot(dx, dy);
  joyVec = len > max ? { x: dx / len, y: dy / len } : { x: dx / max, y: dy / max };
  joyStick.style.transform = `translate(calc(-50% + ${Math.min(dx, max)}px), calc(-50% + ${Math.min(dy, max)}px))`;
};

joyBase.addEventListener('touchstart', (ev) => {
  joyActive = true;
  joyHandler(ev as TouchEvent);
  ev.preventDefault();
});
joyBase.addEventListener('touchmove', (ev) => {
  if (joyActive) joyHandler(ev as TouchEvent);
  ev.preventDefault();
});
joyBase.addEventListener('touchend', () => {
  joyActive = false;
  joyVec = { x: 0, y: 0 };
  joyStick.style.transform = 'translate(-50%, -50%)';
});

const bindTouchButton = (id: string, down: () => void, up?: () => void): void => {
  const el = $(id);
  el.addEventListener('touchstart', (ev) => {
    down();
    ev.preventDefault();
  });
  if (up) el.addEventListener('touchend', up);
};

bindTouchButton('btnFire', () => {
  if (latestSnapshot?.phase === 'drop' && latestSnapshot) {
    const rect = canvasEl.getBoundingClientRect();
    sendDropChoiceFromClick(rect.left + rect.width / 2, rect.top + rect.height / 2);
  } else {
    firing = true;
  }
}, () => {
  firing = false;
});
bindTouchButton('btnPickup', () => net?.sendAction({ t: 'action', kind: 'pickup' }));
bindTouchButton('btnReload', () => net?.sendAction({ t: 'action', kind: 'reload' }));
bindTouchButton('btnHeal', () => net?.sendAction({ t: 'action', kind: 'use', consumable: 'botiquin' }));
bindTouchButton('btnShield', () => net?.sendAction({ t: 'action', kind: 'use', consumable: 'escudo' }));
bindTouchButton('btnSwap', () =>
  net?.sendAction({ t: 'action', kind: 'swap', slot: latestSnapshot?.you ? 1 - latestSnapshot.you.activeSlot : 0 }),
);
bindTouchButton('btnGrenade', () => net?.sendAction({ t: 'action', kind: 'throwGrenade' }));
bindTouchButton('btnAbility', () => net?.sendAction({ t: 'action', kind: 'ability' }));
const labelTouchButtons = (): void => {
  const labels: Array<[string, string]> = [
    ['btnPickup', t('pickup', settings.lang)],
    ['btnReload', t('reload', settings.lang)],
    ['btnHeal', '＋'],
    ['btnShield', '◈'],
    ['btnSwap', '⇄'],
    ['btnGrenade', '◉'],
    ['btnAbility', '⚡'],
    ['btnSlide', t('slide', settings.lang)],
    ['btnProne', t('prone', settings.lang)],
  ];
  for (const [id, label] of labels) $(id).textContent = label;
};
labelTouchButtons();
bindTouchButton('btnSlide', () => {
  slideQueued = true;
});
bindTouchButton('btnProne', () => {
  proneToggle = !proneToggle;
  $('btnProne').classList.toggle('active', proneToggle);
});

let lastInputSent = 0;
const inputIntervalMs = (): number => (settings.dataSaver ? 66 : 33);
const sendInputLoop = (): void => {
  if (!net || mode === 'menu') return;
  const now = performance.now();
  if (now - lastInputSent >= inputIntervalMs()) {
    lastInputSent = now;
    let mx = 0;
    let my = 0;
    if (keysDown.has(keyFor('forward'))) my -= 1;
    if (keysDown.has(keyFor('back'))) my += 1;
    if (keysDown.has(keyFor('left'))) mx -= 1;
    if (keysDown.has(keyFor('right'))) mx += 1;
    if (joyActive) {
      mx = joyVec.x;
      my = joyVec.y;
    }
    const prone = keysDown.has(keyFor('prone')) || proneToggle;
    net.sendInput(mx, my, mouseAim, firing, slideQueued, prone);
    slideQueued = false;
  }
  requestAnimationFrame(sendInputLoop);
};

// ---------- Bucle de render ----------
let lastFrame = performance.now();
let lastFpsFrame = 0;
const renderLoop = (): void => {
  const now = performance.now();
  const dt = now - lastFrame;
  lastFrame = now;
  if (settings.fpsCap < 240 && now - lastFpsFrame < 1000 / settings.fpsCap - 1) {
    requestAnimationFrame(renderLoop);
    return;
  }
  lastFpsFrame = now;
  if (mode !== 'menu' && localServer) {
    localServer.update(dt);
  }
  renderer.render({
    snapshot: latestSnapshot,
    yourId,
    map: gameMap,
    prevPlayers: prevPositions,
    renderTime: now,
    spectateId,
    dtMs: dt,
    wings: settings.wings,
  });
  requestAnimationFrame(renderLoop);
};

// ---------- Menús y ajustes ----------
$('btnSolo').addEventListener('click', startSolo);
$('btnHost').addEventListener('click', () => {
  $('p2pHostPanel').classList.toggle('hidden');
  $('p2pJoinPanel').classList.add('hidden');
});
$('btnJoin').addEventListener('click', () => {
  $('joinRow').classList.toggle('hidden');
  $('p2pJoinPanel').classList.toggle('hidden');
  $('p2pHostPanel').classList.add('hidden');
});
$('btnConnect').addEventListener('click', () => void startWs());
$('btnCreateOffer').addEventListener('click', () => void startP2pHost());
$('btnAcceptAnswer').addEventListener('click', () => {
  const code = $input('answerIn').value.trim();
  if (code) void p2pHost.acceptAnswer(code).then(() => banner('Invitado conectado / Guest connected'));
});
$('btnJoinP2p').addEventListener('click', () => void startP2pGuest());
$('btnCopyOffer').addEventListener('click', () => {
  void navigator.clipboard?.writeText($input('offerOut').value);
  banner('Copiado / Copied');
});
$('btnCopyAnswer').addEventListener('click', () => {
  void navigator.clipboard?.writeText($input('answerOut').value);
  banner('Copiado / Copied');
});
$('btnSettings').addEventListener('click', () => {
  showScreen('settings');
  renderKeybinds();
});
$('btnBackSettings').addEventListener('click', () => showScreen('menu'));

$input('selLang').value = settings.lang;
$('selLang').addEventListener('change', () => {
  settings.lang = ($input('selLang').value as 'es' | 'en');
  applyI18n(settings);
  saveSettings(settings);
});
const selCharacter = $<HTMLSelectElement>('selCharacter');
for (const id of CHARACTER_IDS) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = t(`char_${id}`, settings.lang);
  selCharacter.appendChild(opt);
}
selCharacter.value = selectedCharacter;
selCharacter.addEventListener('change', () => {
  selectedCharacter = selCharacter.value as CharacterId;
  saveSettings({ ...settings });
});
const chkWings = $<HTMLInputElement>('chkWings');
chkWings.checked = settings.wings;
chkWings.addEventListener('change', () => {
  settings.wings = chkWings.checked;
  saveSettings(settings);
});
$input('rngSens').value = String(settings.sensitivity);
$('sensVal').textContent = settings.sensitivity.toFixed(1);
$('rngSens').addEventListener('input', () => {
  settings.sensitivity = Number($input('rngSens').value);
  $('sensVal').textContent = settings.sensitivity.toFixed(1);
  saveSettings(settings);
});
$input('rngText').value = String(settings.textScale);
$('rngText').addEventListener('input', () => {
  settings.textScale = Number($input('rngText').value);
  applySettingsToDom(settings);
  saveSettings(settings);
});
$input('chkContrast').checked = settings.highContrast;
$('chkContrast').addEventListener('change', () => {
  settings.highContrast = $input('chkContrast').checked;
  applySettingsToDom(settings);
  saveSettings(settings);
});
$input('chkSubs').checked = settings.subtitles;
$('chkSubs').addEventListener('change', () => {
  settings.subtitles = $input('chkSubs').checked;
  saveSettings(settings);
});

const selMode = $<HTMLSelectElement>('selMode');
for (const id of Object.keys(GAME_MODES) as GameModeId[]) {
  const def = GAME_MODES[id];
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = `${def.nameEs}${def.implemented ? '' : ' (pronto)'}`;
  selMode.appendChild(opt);
}
selMode.value = selectedMode;
selMode.addEventListener('change', () => {
  const value = selMode.value;
  if (isGameModeId(value)) selectedMode = value;
  saveSettings({ ...settings });
});

const bindSelect = <T extends string | number>(
  id: string,
  get: () => T,
  set: (value: string) => void,
): void => {
  const el = $<HTMLSelectElement>(id);
  el.value = String(get());
  el.addEventListener('change', () => {
    set(el.value);
    saveSettings(settings);
  });
};

bindSelect('selQuality', () => settings.quality, (v) => {
  settings.quality = v as Settings['quality'];
  applyRenderQuality();
});
bindSelect('selFps', () => settings.fpsCap, (v) => {
  settings.fpsCap = Number(v);
});
bindSelect('selColorblind', () => settings.colorblind, (v) => {
  settings.colorblind = v as Settings['colorblind'];
  applySettingsToDom(settings);
});
bindSelect('selRegion', () => settings.region, (v) => {
  settings.region = v;
});

const bindCheck = (id: string, get: () => boolean, set: (value: boolean) => void): void => {
  const el = $<HTMLInputElement>(id);
  el.checked = get();
  el.addEventListener('change', () => {
    set(el.checked);
    saveSettings(settings);
  });
};

bindCheck('chkShadows', () => settings.shadows, (v) => {
  settings.shadows = v;
  applyRenderQuality();
});
bindCheck('chkDamage', () => settings.damageIndicators, (v) => {
  settings.damageIndicators = v;
});
bindCheck('chkDataSaver', () => settings.dataSaver, (v) => {
  settings.dataSaver = v;
});
bindSelect('selFilter', () => settings.filter, (v) => {
  settings.filter = v as Settings['filter'];
  applyRenderQuality();
});
bindCheck('chkReduceFx', () => settings.reduceEffects, (v) => {
  settings.reduceEffects = v;
  applyRenderQuality();
});

const bindRange = (id: string, get: () => number, set: (value: number) => void): void => {
  const el = $<HTMLInputElement>(id);
  el.value = String(get());
  el.addEventListener('input', () => {
    set(Number(el.value));
    saveSettings(settings);
  });
};

bindRange('rngBrightness', () => settings.brightness, (v) => {
  settings.brightness = v;
  applyRenderQuality();
});
bindRange('rngVolMaster', () => settings.volMaster, (v) => {
  settings.volMaster = v;
  applyRenderQuality();
});
bindRange('rngVolMusic', () => settings.volMusic, (v) => {
  settings.volMusic = v;
  applyRenderQuality();
});
bindRange('rngVolSfx', () => settings.volSfx, (v) => {
  settings.volSfx = v;
  applyRenderQuality();
});

initAuthScreen(
  () => settings.lang,
  () => {
    applyI18n(settings);
    renderMeta();
  },
);

const KEYBIND_ACTIONS = ['forward', 'back', 'left', 'right', 'reload', 'pickup', 'heal', 'shieldItem', 'swap', 'grenade', 'ability', 'slide', 'prone'] as const;

const renderKeybinds = (): void => {
  const list = $('keybindList');
  list.innerHTML = '';
  for (const action of KEYBIND_ACTIONS) {
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('label');
    label.textContent = t(action, settings.lang);
    const kbd = document.createElement('kbd');
    kbd.textContent = keyLabel(settings.keys[action] ?? '');
    kbd.addEventListener('click', () => {
      kbd.textContent = t('pressKey', settings.lang);
      const handler = (ev: KeyboardEvent): void => {
        ev.preventDefault();
        settings.keys[action] = ev.code;
        kbd.textContent = keyLabel(ev.code);
        saveSettings(settings);
        window.removeEventListener('keydown', handler, true);
      };
      window.addEventListener('keydown', handler, true);
    });
    row.append(label, kbd);
    list.appendChild(row);
  }
};

window.addEventListener('resize', () => renderer.resize());

if (isTouchDevice) {
  $('touchControls').classList.remove('hidden');
}

renderer.resize();
requestAnimationFrame(renderLoop);
requestAnimationFrame(sendInputLoop);
