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
import {
  emptyStatsDelta,
  addStatsDelta,
  dailyMissionsFor,
  WEEKLY_MISSIONS,
  rollOverIfNeeded,
  recordMatchInMissions,
  claimMissionReward,
  freshMissionState,
  ACHIEVEMENTS,
  DAILY_LOGIN_CYCLE,
  dailyLoginRewardFor,
  canClaimDailyLogin,
  type MatchStatsDelta,
  type MissionState,
  type MissionDef,
} from '../meta/progression.js';
import { FRAGMENTS_PER_MATCH, VIP_NX_BONUS_PCT, VIP_DAILY_DALOS } from '../meta/economy.js';
import { RANK_TIERS, rankFromPoints } from '../meta/progression.js';
import { EQUIP_SLOTS, EQUIP_SLOT_LABELS } from '../shared/locker.js';
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
  missions: 'nexo_missions',
  totals: 'nexo_totals',
  claimedAchievements: 'nexo_achievements_claimed',
  fragments: 'nexo_fragments',
  lastLocalDaily: 'nexo_last_daily_claim',
  localStreak: 'nexo_daily_streak',
  vipUntil: 'nexo_vip_until',
  lastVipClaim: 'nexo_last_vip_claim',
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

export const getFragments = (): number => readNum(KEYS.fragments);
export const addFragments = (amount: number): number => {
  const next = getFragments() + Math.floor(amount);
  writeNum(KEYS.fragments, next);
  return next;
};

const readTotals = (): MatchStatsDelta => {
  try {
    const raw = localStorage.getItem(KEYS.totals);
    return raw ? { ...emptyStatsDelta(), ...(JSON.parse(raw) as MatchStatsDelta) } : emptyStatsDelta();
  } catch {
    return emptyStatsDelta();
  }
};
const writeTotals = (totals: MatchStatsDelta): void => {
  localStorage.setItem(KEYS.totals, JSON.stringify(totals));
};

const readMissionState = (): MissionState => {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(KEYS.missions);
    if (raw) return rollOverIfNeeded(JSON.parse(raw) as MissionState, now);
  } catch {
    // corrupted state falls through to fresh
  }
  return freshMissionState(now);
};
const writeMissionState = (state: MissionState): void => {
  localStorage.setItem(KEYS.missions, JSON.stringify(state));
};

const readClaimedAchievements = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEYS.claimedAchievements) ?? '[]') as string[];
  } catch {
    return [];
  }
};
const writeClaimedAchievements = (ids: string[]): void => {
  localStorage.setItem(KEYS.claimedAchievements, JSON.stringify(ids));
};

export const vipActiveLocal = (): boolean => readNum(KEYS.vipUntil) > Date.now();
export const vipDaysLeft = (): number => Math.max(0, Math.ceil((readNum(KEYS.vipUntil) - Date.now()) / 86_400_000));
export const activateVipLocal = (): void => {
  const base = Math.max(readNum(KEYS.vipUntil), Date.now());
  writeNum(KEYS.vipUntil, base + 30 * 86_400_000);
};
export const vipDailyClaimAvailable = (): boolean =>
  vipActiveLocal() && Date.now() - readNum(KEYS.lastVipClaim) >= 86_400_000;
export const claimVipDaily = (): number => {
  writeNum(KEYS.lastVipClaim, Date.now());
  return addDalos(VIP_DAILY_DALOS);
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

/** Recompensas al terminar una partida: NX, XP de pase, maestría, misiones, logros y fragmentos. */
export const grantMatchRewards = (
  kills: number,
  placement: number,
  totalPlayers: number,
  characterId: CharacterId,
  extra?: Partial<MatchStatsDelta>,
): { nx: number; totalNx: number; passXp: number; claimed: PassReward[] } => {
  const baseNx = computeMatchNxEarned(kills, placement, totalPlayers);
  const nx = vipActiveLocal() ? baseNx + Math.floor((baseNx * VIP_NX_BONUS_PCT) / 100) : baseNx;
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

  const delta: MatchStatsDelta = {
    ...emptyStatsDelta(),
    kills,
    matches: 1,
    wins: placement === 1 ? 1 : 0,
    top5: placement >= 1 && placement <= 5 ? 1 : 0,
    ...extra,
  };
  writeTotals(addStatsDelta(readTotals(), delta));
  writeMissionState(recordMatchInMissions(readMissionState(), delta));
  addFragments(FRAGMENTS_PER_MATCH);

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
  for (const slot of EQUIP_SLOTS) {
    const equipped = locker.equipped[slot];
    const label = EQUIP_SLOT_LABELS[slot][l];
    const row = document.createElement('div');
    row.className = 'locker-slot';
    row.innerHTML = `<b>${label}</b> <span>${equipped ?? (l === 'es' ? '— vacío —' : '— empty —')}</span>`;
    grid.appendChild(row);
  }
  const frag = $('lockerFragments');
  frag.textContent = l === 'es' ? `⚙ Fragmentos: ${getFragments()}` : `⚙ Fragments: ${getFragments()}`;
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

/* ===== Misiones / Logros / Social / Códigos ===== */

const missionRow = (def: MissionDef, entry: { progress: number; claimed: boolean } | undefined, period: 'daily' | 'weekly', l: 'es' | 'en'): HTMLDivElement => {
  const e = entry ?? { progress: 0, claimed: false };
  const pct = Math.min(100, Math.round((e.progress / def.target) * 100));
  const reward = def.reward.nx ? `${def.reward.nx} NX` : `${def.reward.dalos} Dalos`;
  const row = document.createElement('div');
  row.className = 'mission-row';
  row.innerHTML = `
    <div class="mission-desc">${l === 'es' ? def.descEs : def.descEn}</div>
    <div class="pass-track"><div class="pass-fill" style="width:${pct}%"></div></div>
    <div class="mission-foot"><span>${e.progress}/${def.target} · ${reward}</span>
    <button class="btn small ${e.claimed || e.progress < def.target ? '' : 'primary'}" ${e.claimed || e.progress < def.target ? 'disabled' : ''}>
      ${e.claimed ? (l === 'es' ? 'Reclamado' : 'Claimed') : l === 'es' ? 'Reclamar' : 'Claim'}
    </button></div>`;
  row.querySelector('button')!.addEventListener('click', () => {
    const res = claimMissionReward(readMissionState(), period, def.id);
    if (res.reward) {
      if (res.reward.nx) addNx(res.reward.nx);
      if (res.reward.dalos) addDalos(res.reward.dalos);
      writeMissionState(res.state);
      metaBanner(l === 'es' ? `¡Recompensa reclamada! +${reward}` : `Reward claimed! +${reward}`);
      renderMeta();
    }
  });
  return row;
};

const renderMisiones = (): void => {
  const l = lang();
  const state = readMissionState();
  const dailyWrap = $('dailyMissions');
  const weeklyWrap = $('weeklyMissions');
  dailyWrap.innerHTML = `<h3>${l === 'es' ? 'Diarias' : 'Daily'}</h3>`;
  weeklyWrap.innerHTML = `<h3>${l === 'es' ? 'Semanales' : 'Weekly'}</h3>`;
  for (const def of dailyMissionsFor(Date.now())) dailyWrap.appendChild(missionRow(def, state.daily[def.id], 'daily', l));
  for (const def of WEEKLY_MISSIONS) weeklyWrap.appendChild(missionRow(def, state.weekly[def.id], 'weekly', l));

  const dailyBtn = $('btnClaimDaily') as HTMLButtonElement;
  const today = Math.floor(Date.now() / 86_400_000);
  const lastDay = readNum(KEYS.lastLocalDaily);
  const streak = readNum(KEYS.localStreak, 1);
  const canLocal = canClaimDailyLogin(lastDay, today);
  const reward = dailyLoginRewardFor(streak);
  dailyBtn.disabled = !canLocal;
  dailyBtn.textContent = canLocal
    ? l === 'es'
      ? `🎁 Día ${streak}: reclamar +${reward.nx} NX${reward.dalos ? ` +${reward.dalos} Dalos` : ''}`
      : `🎁 Day ${streak}: claim +${reward.nx} NX${reward.dalos ? ` +${reward.dalos} Dalos` : ''}`
    : l === 'es'
      ? 'Recompensa de hoy ya reclamada'
      : "Today's reward already claimed";
  const cycle = $('dailyLoginCycle');
  cycle.innerHTML = DAILY_LOGIN_CYCLE.map(
    (d) => `<span class="cycle-day ${d.day <= streak ? 'done' : ''}">${l === 'es' ? 'Día' : 'Day'} ${d.day}: ${d.nx}NX${d.dalos ? `+${d.dalos}◆` : ''}</span>`,
  ).join('');
};

const claimLocalDaily = (): void => {
  const today = Math.floor(Date.now() / 86_400_000);
  const lastDay = readNum(KEYS.lastLocalDaily);
  if (!canClaimDailyLogin(lastDay, today)) return;
  const streak = lastDay && today - lastDay === 1 ? (readNum(KEYS.localStreak) % 7) + 1 : 1;
  const reward = dailyLoginRewardFor(streak);
  addNx(reward.nx);
  if (reward.dalos) addDalos(reward.dalos);
  writeNum(KEYS.lastLocalDaily, today);
  writeNum(KEYS.localStreak, streak);
  metaBanner(lang() === 'es' ? `¡Día ${streak} reclamado!` : `Day ${streak} claimed!`);
  renderMeta();
};

const renderLogros = (): void => {
  const l = lang();
  const totals = readTotals();
  const claimed = readClaimedAchievements();
  const wrap = $('achievementsList');
  wrap.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const pct = Math.min(100, Math.round((totals[a.kind] / a.target) * 100));
    const done = totals[a.kind] >= a.target;
    const isClaimed = claimed.includes(a.id);
    const reward = a.reward.nx ? `${a.reward.nx} NX` : `${a.reward.dalos} Dalos`;
    const row = document.createElement('div');
    row.className = 'mission-row';
    row.innerHTML = `
      <div class="mission-desc">${l === 'es' ? a.descEs : a.descEn}</div>
      <div class="pass-track"><div class="pass-fill" style="width:${pct}%"></div></div>
      <div class="mission-foot"><span>${Math.min(totals[a.kind], a.target)}/${a.target} · ${reward}</span>
      <button class="btn small ${done && !isClaimed ? 'primary' : ''}" ${!done || isClaimed ? 'disabled' : ''}>
        ${isClaimed ? (l === 'es' ? 'Reclamado' : 'Claimed') : l === 'es' ? 'Reclamar' : 'Claim'}
      </button></div>`;
    row.querySelector('button')!.addEventListener('click', () => {
      if (a.reward.nx) addNx(a.reward.nx);
      if (a.reward.dalos) addDalos(a.reward.dalos);
      writeClaimedAchievements([...claimed, a.id]);
      metaBanner(l === 'es' ? '¡Logro completado!' : 'Achievement completed!');
      renderMeta();
    });
    wrap.appendChild(row);
  }
  const rank = rankFromPoints(totals.wins * 40 + totals.kills * 6);
  const rankEl = $('rankDisplay');
  rankEl.innerHTML = RANK_TIERS.map(
    (rt) => `<span class="rank-tier" style="color:${rt.color}">${l === 'es' ? rt.nameEs : rt.nameEn} (${rt.minPoints})</span>`,
  ).join('');
};

let apiProfile: { name: string; stats: Record<string, number>; friends: string[]; clan: { name: string; coins: number } | null } | null = null;

const fetchApiProfile = async (): Promise<void> => {
  const token = localStorage.getItem('nexo_auth_token');
  if (!token) return;
  try {
    const res = await fetch('/api/profile', { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = (await res.json()) as {
      account: { name: string; stats: Record<string, number> };
      friends: string[];
      clan: { name: string; coins: number } | null;
    };
    apiProfile = { name: data.account.name, stats: data.account.stats, friends: data.friends, clan: data.clan };
  } catch {
    apiProfile = null;
  }
};

const apiPost = async (path: string, body: unknown, method = 'POST'): Promise<Record<string, unknown>> => {
  const token = localStorage.getItem('nexo_auth_token');
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Record<string, unknown>;
};

const renderSocial = (): void => {
  const l = lang();
  const wrap = $('socialContent');
  if (!apiProfile) {
    wrap.innerHTML = `<p class="muted">${l === 'es' ? 'Inicia sesión para usar amigos, clanes y rankings.' : 'Log in to use friends, clans and leaderboards.'}</p>`;
    return;
  }
  const friends = apiProfile.friends.map((f) => `<li>👤 ${f}</li>`).join('') || `<li class="muted">${l === 'es' ? 'Sin amigos aún' : 'No friends yet'}</li>`;
  const clan = apiProfile.clan
    ? `<p>🛡 <b>${apiProfile.clan.name}</b> · ${l === 'es' ? 'Monedas de clan' : 'Clan coins'}: ${apiProfile.clan.coins}</p>`
    : `<p class="muted">${l === 'es' ? 'Sin clan' : 'No clan'}</p>`;
  wrap.innerHTML = `
    <h3>${l === 'es' ? 'Amigos' : 'Friends'}</h3>
    <div class="row"><input id="inFriendName" placeholder="${l === 'es' ? 'Nombre del jugador' : 'Player name'}" />
    <button id="btnAddFriend" class="btn small primary">+</button></div>
    <ul class="friend-list">${friends}</ul>
    <h3>${l === 'es' ? 'Clan' : 'Clan'}</h3>
    ${clan}
    <div class="row"><input id="inClanName" placeholder="${l === 'es' ? 'Nombre del clan' : 'Clan name'}" />
    <button id="btnCreateClan" class="btn small">${l === 'es' ? 'Crear' : 'Create'}</button>
    <button id="btnJoinClan" class="btn small">${l === 'es' ? 'Unirse' : 'Join'}</button>
    ${apiProfile.clan ? `<button id="btnLeaveClan" class="btn small">${l === 'es' ? 'Salir' : 'Leave'}</button>` : ''}</div>
    <h3>${l === 'es' ? 'Reportar jugador' : 'Report player'}</h3>
    <div class="row"><input id="inReportId" placeholder="ID" />
    <input id="inReportReason" placeholder="${l === 'es' ? 'Motivo' : 'Reason'}" />
    <button id="btnSendReport" class="btn small">🚩</button></div>`;

  const inputVal = (id: string): string => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? '';

  $('btnAddFriend').addEventListener('click', () => {
    const name = inputVal('inFriendName');
    if (!name) return;
    void apiPost('/api/social/friend', { name }).then(() => void refreshSocial());
  });
  const btnCreateClan = document.getElementById('btnCreateClan');
  btnCreateClan?.addEventListener('click', () => {
    const name = inputVal('inClanName');
    if (!name) return;
    void apiPost('/api/social/clan', { name }).then(() => void refreshSocial());
  });
  const btnJoinClan = document.getElementById('btnJoinClan');
  btnJoinClan?.addEventListener('click', () => {
    const name = inputVal('inClanName');
    if (!name) return;
    void apiPost('/api/social/clan', { name }, 'PUT').then(() => void refreshSocial());
  });
  const btnLeaveClan = document.getElementById('btnLeaveClan');
  btnLeaveClan?.addEventListener('click', () => {
    void apiPost('/api/social/clan', {}, 'DELETE').then(() => void refreshSocial());
  });
  const btnSendReport = document.getElementById('btnSendReport');
  btnSendReport?.addEventListener('click', () => {
    const reportedId = inputVal('inReportId');
    const reason = inputVal('inReportReason');
    if (!reportedId || !reason) return;
    void apiPost('/api/reports', { reportedId, reason }).then(() => {
      metaBanner(l === 'es' ? 'Reporte enviado. ¡Gracias!' : 'Report sent. Thank you!');
    });
  });
};

const refreshSocial = async (): Promise<void> => {
  await fetchApiProfile();
  renderSocial();
  await renderLeaderboard();
};

const renderLeaderboard = async (): Promise<void> => {
  const l = lang();
  const wrap = $('leaderboardList');
  const field = ($('selLbField') as HTMLSelectElement).value;
  try {
    const res = await fetch(`/api/leaderboard?field=${field}`);
    if (!res.ok) throw new Error();
    const data = (await res.json()) as { entries: Array<{ name: string; value: number }> };
    wrap.innerHTML = data.entries.length
      ? data.entries
          .map(
            (e, i) =>
              `<div class="lb-row"><span class="lb-pos">#${i + 1}</span><span>${e.name}</span><b>${e.value}</b></div>`,
          )
          .join('')
      : `<p class="muted">${l === 'es' ? 'Sin datos aún' : 'No data yet'}</p>`;
  } catch {
    wrap.innerHTML = `<p class="muted">${l === 'es' ? 'Rankings no disponibles en este servidor' : 'Leaderboards unavailable on this server'}</p>`;
  }
};

const renderCodigos = (): void => {
  const l = lang();
  $('redeemMsg').textContent = '';
  $('btnRedeem').textContent = l === 'es' ? 'Canjear' : 'Redeem';
};

export const renderMeta = (): void => {
  $('nxBalance').textContent = `${getNx()} NX · ${getDalos()} Dalos${vipActiveLocal() ? ' · VIP ✦' : ''}`;
  const active = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
  if (active === 'tienda') renderStore();
  if (active === 'pase') renderPass();
  if (active === 'ruleta') renderRoulette();
  if (active === 'armario') renderLocker();
  if (active === 'misiones') renderMisiones();
  if (active === 'logros') renderLogros();
  if (active === 'social') void refreshSocial();
  if (active === 'codigos') renderCodigos();
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
  $('btnClaimDaily').addEventListener('click', claimLocalDaily);
  $('btnRedeem').addEventListener('click', () => {
    const code = ($('inRedeemCode') as HTMLInputElement).value.trim();
    if (!code) return;
    void apiPost('/api/redeem', { code }).then((data) => {
      if (data.ok) {
        const reward = data.reward as { nx?: number; dalos?: number };
        if (reward?.nx) addNx(reward.nx);
        if (reward?.dalos) addDalos(reward.dalos);
        metaBanner(lang() === 'es' ? '¡Código canjeado!' : 'Code redeemed!');
      } else {
        metaBanner(String(data.error ?? 'error'));
      }
      renderMeta();
    });
  });
  const selLb = $<HTMLSelectElement>('selLbField');
  selLb.addEventListener('change', () => void renderLeaderboard());
  renderMeta();
};
