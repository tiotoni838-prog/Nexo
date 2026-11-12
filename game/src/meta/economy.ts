/**
 * Economía extendida: VIP, fragmentos, moneda de evento y códigos de canje.
 * Lógica pura e isomórfica; el servidor valida, el cliente muestra.
 */

/* ===== Suscripción VIP ===== */

export const VIP_PRICE_USD = '4.99';
export const VIP_DURATION_MS = 30 * 86_400_000;
export const VIP_DAILY_DALOS = 60;
export const VIP_NX_BONUS_PCT = 20;

export const vipIsActive = (vipUntilMs: number, nowMs: number): boolean =>
  vipUntilMs > nowMs;

export const vipActivate = (currentUntilMs: number, nowMs: number): number =>
  Math.max(currentUntilMs, nowMs) + VIP_DURATION_MS;

export const vipDailyClaimAvailable = (vipUntilMs: number, lastVipClaimMs: number, nowMs: number): boolean =>
  vipIsActive(vipUntilMs, nowMs) && nowMs - lastVipClaimMs >= 86_400_000;

/** Bonus NX VIP sobre una recompensa base (redondeo a favor del jugador). */
export const vipNxBonus = (baseNx: number): number =>
  Math.floor((baseNx * VIP_NX_BONUS_PCT) / 100);

/* ===== Fragmentos (piezas para fabricar objetos) ===== */

export const FRAGMENTS_TO_CRAFT_RARITY: Record<string, number> = {
  raro: 60,
  epico: 150,
  legendario: 350,
};

export const fragmentsNeededFor = (rarity: string): number =>
  FRAGMENTS_TO_CRAFT_RARITY[rarity] ?? 60;

export const craftItem = (
  balance: number,
  rarity: string,
): { ok: boolean; balance: number } => {
  const cost = fragmentsNeededFor(rarity);
  if (balance < cost) return { ok: false, balance };
  return { ok: true, balance: balance - cost };
};

export const FRAGMENTS_PER_MATCH = 5;

/* ===== Moneda de evento (temporal) ===== */

export interface EventDef {
  id: string;
  nameEs: string;
  nameEn: string;
  endsAtMs: number;
  tokenNameEs: string;
  tokenNameEn: string;
  exchange: Array<{ sku: string; cost: number; labelEs: string; labelEn: string }>;
}

export const eventIsActive = (event: EventDef, nowMs: number): boolean =>
  nowMs < event.endsAtMs;

export const eventMsRemaining = (event: EventDef, nowMs: number): number =>
  Math.max(0, event.endsAtMs - nowMs);

export const eventExchange = (
  event: EventDef,
  balance: number,
  cost: number,
  nowMs: number,
): { ok: boolean; balance: number; reason?: string } => {
  if (!eventIsActive(event, nowMs)) return { ok: false, balance, reason: 'event-ended' };
  if (balance < cost) return { ok: false, balance, reason: 'insufficient-tokens' };
  return { ok: true, balance: balance - cost };
};

/* ===== Códigos de canje ===== */

export interface RedeemCodeDef {
  code: string;
  reward: { nx?: number; dalos?: number };
  expiresAtMs: number;
  maxUses: number;
  uses: number;
}

export const validateRedeemCode = (
  def: RedeemCodeDef | undefined,
  nowMs: number,
): { ok: boolean; reason?: string } => {
  if (!def) return { ok: false, reason: 'code-not-found' };
  if (nowMs >= def.expiresAtMs) return { ok: false, reason: 'code-expired' };
  if (def.uses >= def.maxUses) return { ok: false, reason: 'code-exhausted' };
  return { ok: true };
};

export const normalizeCode = (input: string): string =>
  input.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

export const REDEEM_COOLDOWN_MS = 60_000;
export const canRedeemAgain = (lastRedeemMs: number, nowMs: number): boolean =>
  nowMs - lastRedeemMs >= REDEEM_COOLDOWN_MS;
