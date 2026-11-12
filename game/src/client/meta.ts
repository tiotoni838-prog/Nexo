import {
  STORE_CATALOG,
  DALO_PACKS,
  computeMatchNxEarned,
  daloPackAmount,
  type StoreItem,
} from '../paypal/store.js';
import {
  BATTLE_PASS,
  PASS_TIERS,
  passXpForMatch,
  passLevelFromXp,
  passTierReward,
  type PassReward,
} from '../shared/battlePass.js';
import {
  ROULETTE_POOL,
  ROULETTE_SPIN_COST_DALOS,
  spinRoulette,
  canFreeSpin,
  nextFreeSpinMs,
} from '../shared/roulette.js';
import {
  emptyLocker,
  ownItem,
  isOwned,
  equipItem,
  masteryProgress,
  masteryTitle,
  type EquipSlot,
  type LockerState,
} from '../shared/locker.js';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from '../shared/characters.js';
import { t } from '../shared/i18n.js';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const KEYS = {
  nx: 'nexo_nx_balance',
  dalos: 'nexo_dalos_balance',
  locker: 'nexo_locker',
  passXp: 'nexo_pass_xp',
  passPremium: 'nexo_pass_premium',
  lastFreeSpin: 'nexo_last_free_spin',
  mastery: 'nexo_mastery',
} as const;

const readNum = (key: string, fallback = 0): number => {
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) ? n : fallback;
};
const writeNum = (key: string, value: number): void => {
  localStorage.setItem(key, String(Math.max(0, Math.floor(value))));
};

export const getNx = (): number => readNum(KEYS.nx);
export const addNx = (amount: number): number => {
  const next = getNx() + Math.floor(amount);
  writeNum(KEYS.nx, next);
  return next;
};
export const getDalos = (): number => readNum(KEYS.dalos);
export const addDalos = (amount: number): number => {
  const next = getDalos() + Math.floor(amount);
  writeNum(KEYS.dalos, next);
  return next;
};

const readLocker = (): LockerState => {
  try {
    const raw = localStorage.getItem(KEYS.locker);
    if (!raw) return emptyLocker();
    const parsed = JSON.parse(raw) as LockerState;
    return { owned: parsed.owned ?? [], equipped: parsed.equipped ?? {} };
  } catch {
    return emptyLocker();
  }
};
const writeLocker = (locker: LockerState): void => {
  localStorage.setItem(KEYS.locker, JSON.stringify(locker));
};

const getPassXp = (): number => readNum(KEYS.passXp);
const addPassXp = (xp: number): number => {
  const next = getPassXp() + Math.floor(xp);
  writeNum(KEYS.passXp, next);
  return next;
};
const isPremiumPass = (): boolean => localStorage.getItem(KEYS.passPremium) === '1';
const activatePremiumPass = (): void => {
  localStorage.setItem(KEYS.passPremium, '1');
};

const readMastery = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(KEYS.mastery) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
};
const addMasteryXp = (characterId: string, xp: number): number => {
  const all = readMastery();
  all[characterId] = (all[characterId] ?? 0) + Math.floor(xp);
  localStorage.setItem(KEYS.mastery, JSON.stringify(all));
  return all[characterId]!;
};

const lang = (): 'es' | 'en' => {
  const raw = localStorage.getItem('nexo_settings');
  try {
    return ((raw ? JSON.parse(raw) : {}) as { lang?: 'es' | 'en' }).lang ?? 'es';
  } catch {
    return 'es';
  }
};

let bannerTimer = 0;
export const metaBanner = (msg: string): void => {
  const el = $('metaBanner');
  el.textContent = msg;
  el.classList.remove('hidden');
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => el.classList.add('hidden'), 3500);
};

/** Recompensas al terminar una partida: NX, XP de pase y maestría. */
export const grantMatchRewards = (
  kills: number,
  placement: number,
  totalPlayers: number,
  characterId: CharacterId,
): { nx: number; totalNx: number; passXp: number; claimed: PassReward[] } => {
  const nx = computeMatchNxEarned(kills, placement, totalPlayers);
  const totalNx = addNx(nx);
  const xp = passXpForMatch(kills, placement, totalPlayers);
  const prevLevel = passLevelFromXp(getPassXp()).tier;
  const newLevel = passLevelFromXp(addPassXp(xp)).tier;
  addMasteryXp(characterId, xp);
  const claimed: PassReward[] = [];
  const premium = isPremiumPass();
  const locker = readLocker();
  let lockerDirty = false;
  for (let tier = prevLevel + 1; tier <= newLevel; tier++) {
    const reward = passTierReward(tier, premium);
    if (!reward) continue;
    if (reward.kind === 'nx' && reward.amount) addNx(reward.amount);
    if (reward.kind === 'dalo' && reward.amount) addDalos(reward.amount);
    if (reward.sku && reward.kind !== 'nx' && reward.kind !== 'dalo') {
      if (!isOwned(locker, reward.sku)) {
        locker.owned.push(reward.sku);
        lockerDirty = true;
      }
    }
    claimed.push(reward);
  }
  if (lockerDirty) writeLocker(locker);
  return { nx, totalNx, passXp: xp, claimed };
};

/** Procesa ?comprado=<sku> tras volver de PayPal. */
export const processPurchaseReturn = (): void => {
  const params = new URLSearchParams(location.search);
  const sku = params.get('comprado');
  if (!sku) return;
  history.replaceState(null, '', location.pathname);
  const daloAmount = daloPackAmount(sku);
  if (daloAmount > 0) {
    const total = addDalos(daloAmount);
    metaBanner(`¡+${daloAmount} Dalos! Total: ${total} ◆`);
    return;
  }
  writeLocker(ownItem(readLocker(), sku));
  metaBanner(lang() === 'es' ? '¡Artículo añadido a tu armario!' : 'Item added to your locker!');
};

const priceLabel = (item: StoreItem): string => {
  if (item.currency === 'USD') return `$${item.priceUsd}`;
  if (item.currency === 'NX') return `${item.priceNx} NX`;
  return `${item.priceDalos} Dalos`;
};

const buyWithWallet = (item: StoreItem): boolean => {
  if (item.currency === 'NX' && item.priceNx !== undefined) {
    if (getNx() < item.priceNx) {
      metaBanner(lang() === 'es' ? 'NX insuficientes' : 'Not enough NX');
      return false;
    }
    addNx(-item.priceNx);
  } else if (item.currency === 'DALO' && item.priceDalos !== undefined) {
    if (getDalos() < item.priceDalos) {
      metaBanner(lang() === 'es' ? 'Dalos insuficientes' : 'Not enough Dalos');
      return false;
    }
    addDalos(-item.priceDalos);
  } else {
    return false;
  }
  writeLocker(ownItem(readLocker(), item.sku));
  metaBanner(lang() === 'es' ? `¡${item.nameEs} conseguido!` : `${item.nameEn} unlocked!`);
  return true;
};

const buyWithPaypal = async (sku: string): Promise<void> => {
  try {
    const res = await fetch('/api/store/purchase', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sku }),
    });
    const data = (await res.json()) as { approveUrl?: string; error?: string; msg?: string };
    if (data.approveUrl) {
      location.href = data.approveUrl;
      return;
    }
    metaBanner(
      data.error === 'store-not-configured'
        ? lang() === 'es'
          ? 'Tienda PayPal no configurada en este servidor'
          : 'PayPal store not configured on this server'
        : (data.error ?? 'error'),
    );
  } catch {
    metaBanner(lang() === 'es' ? 'Sin conexión con la tienda' : 'Store unreachable');
  }
};

const renderStore = (): void => {
  const grid = $('storeGrid');
  const l = lang();
  const items = [...DALO_PACKS, ...STORE_CATALOG];
  grid.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'store-card';
    const owned = item.kind !== 'dalo-pack' && isOwned(readLocker(), item.sku);
    card.innerHTML = `
      <div class="store-name">${l === 'es' ? item.nameEs : item.nameEn}</div>
      <div class="store-meta"><span class="rarity-${item.rarity}">${item.rarity}</span> · ${item.kind}</div>
      <button class="btn small ${item.kind === 'dalo-pack' ? 'dalo' : 'primary'}">${priceLabel(item)}</button>`;
    const btn = card.querySelector('button')!;
    if (owned) {
      btn.textContent = l === 'es' ? 'En tu armario' : 'In your locker';
      btn.disabled = true;
    } else if (item.currency === 'USD') {
      btn.addEventListener('click', () => void buyWithPaypal(item.sku));
    } else {
      btn.addEventListener('click', () => {
        if (buyWithWallet(item)) renderMeta();
      });
    }
    grid.appendChild(card);
  }
};

const renderPass = (): void => {
  const l = lang();
  const xp = getPassXp();
  const { tier, progress } = passLevelFromXp(xp);
  const premium = isPremiumPass();
  $('passHeader').innerHTML = `
    <h3>${l === 'es' ? BATTLE_PASS.nameEs : BATTLE_PASS.nameEn}</h3>
    <p>${l === 'es' ? 'Nivel' : 'Tier'} <b>${tier}</b> / ${BATTLE_PASS.tierCount} · ${xp} XP</p>
    <div class="pass-track"><div class="pass-fill" style="width:${Math.round(progress * 100)}%"></div></div>
    ${premium ? '' : `<button id="btnPremium" class="btn dalo">${l === 'es' ? 'Activar PREMIUM' : 'Activate PREMIUM'} (${BATTLE_PASS.premiumPriceDalos} Dalos)</button>`}`;
  const btnPremium = $('btnPremium');
  if (btnPremium) {
    btnPremium.addEventListener('click', () => {
      if (getDalos() < BATTLE_PASS.premiumPriceDalos) {
        metaBanner(l === 'es' ? 'Dalos insuficientes para el pase premium' : 'Not enough Dalos for premium pass');
        return;
      }
      addDalos(-BATTLE_PASS.premiumPriceDalos);
      activatePremiumPass();
      metaBanner(l === 'es' ? '¡Pase PREMIUM activado!' : 'PREMIUM pass activated!');
      renderMeta();
    });
  }
  const list = $('passTiers');
  list.innerHTML = '';
  for (const tierDef of PASS_TIERS) {
    const reached = tier >= tierDef.tier;
    const row = document.createElement('div');
    row.className = `pass-tier ${reached ? 'reached' : ''}`;
    row.innerHTML = `
      <span class="tier-num">${tierDef.tier}</span>
      <span class="tier-free">${tierDef.free.labelEs}</span>
      <span class="tier-premium">${premium ? tierDef.premium.labelEs : '🔒 ' + tierDef.premium.labelEs}</span>`;
    list.appendChild(row);
  }
};

const renderRoulette = (): void => {
  const l = lang();
  const last = readNum(KEYS.lastFreeSpin);
  const now = Date.now();
  const free = canFreeSpin(last, now);
  const btn = $('btnSpin');
  if (free) {
    btn.textContent = l === 'es' ? '¡GIRO GRATIS!' : 'FREE SPIN!';
    btn.classList.add('primary');
  } else {
    const mins = Math.ceil(nextFreeSpinMs(last, now) / 60000);
    btn.textContent = l === 'es' ? `Girar (${ROULETTE_SPIN_COST_DALOS} Dalos) · gratis en ${mins} min` : `Spin (${ROULETTE_SPIN_COST_DALOS} Dalos) · free in ${mins} min`;
    btn.classList.remove('primary');
  }
  const chances = $('rouletteChances');
  chances.innerHTML = ROULETTE_POOL.map(
    (p) => `<div class="chance rarity-${p.rarity}">${p.labelEs} — ${((p.weight / ROULETTE_POOL.reduce((s, x) => s + x.weight, 0)) * 100).toFixed(1)}%</div>`,
  ).join('');
};

const doSpin = (): void => {
  const l = lang();
  const last = readNum(KEYS.lastFreeSpin);
  const free = canFreeSpin(last, Date.now());
  if (!free) {
    if (getDalos() < ROULETTE_SPIN_COST_DALOS) {
      metaBanner(l === 'es' ? `Necesitas ${ROULETTE_SPIN_COST_DALOS} Dalos` : `You need ${ROULETTE_SPIN_COST_DALOS} Dalos`);
      return;
    }
    addDalos(-ROULETTE_SPIN_COST_DALOS);
  } else {
    writeNum(KEYS.lastFreeSpin, Date.now());
  }
  const prize = spinRoulette();
  if (prize.kind === 'nx' && prize.amount) addNx(prize.amount);
  if (prize.sku) writeLocker(ownItem(readLocker(), prize.sku));
  const result = $('rouletteResult');
  result.textContent = `🎁 ${l === 'es' ? prize.labelEs : prize.labelEn}`;
  result.className = `roulette-result rarity-${prize.rarity}`;
  renderMeta();
};

const renderLocker = (): void => {
  const l = lang();
  const locker = readLocker();
  const grid = $('lockerGrid');
  grid.innerHTML = '';
  const slots: EquipSlot[] = ['skin', 'trail', 'banner', 'emote'];
  for (const slot of slots) {
    const equipped = locker.equipped[slot];
    const row = document.createElement('div');
    row.className = 'locker-slot';
    row.innerHTML = `<b>${slot.toUpperCase()}</b> <span>${equipped ?? (l === 'es' ? '— vacío —' : '— empty —')}</span>`;
    grid.appendChild(row);
  }
  const owned = locker.owned;
  const inv = $('lockerInventory');
  inv.innerHTML = owned.length
    ? ''
    : `<p class="muted">${l === 'es' ? 'Consigue cosméticos en la tienda, el pase o la ruleta.' : 'Earn cosmetics in the store, pass or roulette.'}</p>`;
  for (const sku of owned) {
    const item = STORE_CATALOG.find((i) => i.sku === sku);
    if (!item) continue;
    const slot = item.kind as EquipSlot;
    const card = document.createElement('div');
    card.className = 'store-card';
    const isEquipped = locker.equipped[slot] === sku;
    card.innerHTML = `
      <div class="store-name">${l === 'es' ? item.nameEs : item.nameEn}</div>
      <div class="store-meta"><span class="rarity-${item.rarity}">${item.rarity}</span></div>
      <button class="btn small ${isEquipped ? '' : 'primary'}">${isEquipped ? (l === 'es' ? 'Equipado' : 'Equipped') : l === 'es' ? 'Equipar' : 'Equip'}</button>`;
    card.querySelector('button')!.addEventListener('click', () => {
      const res = equipItem(readLocker(), slot, sku);
      if (res.error) return;
      writeLocker(res.locker);
      renderMeta();
    });
    inv.appendChild(card);
  }
  const mastery = readMastery();
  const masteryEl = $('masteryList');
  masteryEl.innerHTML = `<h3>${l === 'es' ? 'Evolutivas · Maestría' : 'Progression · Mastery'}</h3>`;
  for (const id of CHARACTER_IDS) {
    const xp = mastery[id] ?? 0;
    const prog = masteryProgress(xp);
    const char = CHARACTERS[id];
    const bar = document.createElement('div');
    bar.className = 'mastery-row';
    bar.innerHTML = `
      <span>${l === 'es' ? char.nameEs : char.nameEn} — ${masteryTitle(prog.level, l)} (${prog.level})</span>
      <div class="pass-track"><div class="pass-fill" style="width:${Math.round(prog.progress * 100)}%"></div></div>
      <span class="muted">${prog.xpToNext === null ? (l === 'es' ? 'MAX' : 'MAX') : `${xp} XP · ${prog.xpToNext} → ${l === 'es' ? 'sig.' : 'next'}`}</span>`;
    masteryEl.appendChild(bar);
  }
};

export const renderMeta = (): void => {
  $('nxBalance').textContent = `${getNx()} NX · ${getDalos()} Dalos`;
  const active = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
  if (active === 'tienda') renderStore();
  if (active === 'pase') renderPass();
  if (active === 'ruleta') renderRoulette();
  if (active === 'armario') renderLocker();
};

export const initMetaPanels = (): void => {
  for (const btn of document.querySelectorAll<HTMLButtonElement>('.tab-btn')) {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.menu-panel').forEach((p) => p.classList.add('hidden'));
      const tab = btn.getAttribute('data-tab')!;
      $(tab).classList.remove('hidden');
      renderMeta();
    });
  }
  $('btnSpin').addEventListener('click', doSpin);
  renderMeta();
};
