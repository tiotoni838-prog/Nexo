import { Rng } from './rng.js';

/**
 * Pase de Batalla — Temporada 1 "Amanecer Nexo".
 * 30 niveles, dos rutas: GRATIS y PREMIUM (se activa con Dalos).
 * XP por partida: kills + posición final (misma fórmula que NX, en XP).
 * Sin ventajas competitivas: solo cosméticos y monedas.
 */

export interface PassReward {
  kind: 'nx' | 'dalo' | 'skin' | 'emote' | 'trail' | 'banner';
  sku?: string;
  amount?: number;
  labelEs: string;
  labelEn: string;
}

export interface PassTier {
  tier: number;
  xpRequired: number;
  free: PassReward;
  premium: PassReward;
}

export const BATTLE_PASS = {
  season: 1,
  nameEs: 'Temporada 1: Amanecer Nexo',
  nameEn: 'Season 1: Nexo Dawn',
  tierCount: 30,
  xpPerTier: 500,
  premiumPriceDalos: 950,
} as const;

export const buildPassTiers = (): PassTier[] => {
  const tiers: PassTier[] = [];
  for (let t = 1; t <= BATTLE_PASS.tierCount; t++) {
    const free: PassReward =
      t % 10 === 0
        ? { kind: 'nx', amount: 300, labelEs: '300 NX', labelEn: '300 NX' }
        : t % 5 === 0
          ? { kind: 'emote', sku: 'nx-emote-baile', labelEs: 'Gesto: Baile del Nexo', labelEn: 'Emote: Nexo Dance' }
          : { kind: 'nx', amount: 50, labelEs: '50 NX', labelEn: '50 NX' };
    const premium: PassReward =
      t === BATTLE_PASS.tierCount
        ? { kind: 'skin', sku: 'dalo-skin-fenix', labelEs: 'Skin: Fénix de Dalos', labelEn: 'Skin: Dalos Phoenix' }
        : t % 10 === 0
          ? { kind: 'dalo', amount: 150, labelEs: '150 Dalos', labelEn: '150 Dalos' }
          : t % 3 === 0
            ? { kind: 'trail', sku: 'nx-trail-chispas', labelEs: 'Estela: Chispas de Combate', labelEn: 'Trail: Combat Sparks' }
            : { kind: 'nx', amount: 120, labelEs: '120 NX', labelEn: '120 NX' };
    tiers.push({ tier: t, xpRequired: t * BATTLE_PASS.xpPerTier, free, premium });
  }
  return tiers;
};

export const PASS_TIERS = buildPassTiers();

export const passXpForMatch = (kills: number, placement: number, totalPlayers: number): number => {
  const placementBonus = Math.max(0, totalPlayers - placement + 1) * 10;
  return kills * 25 + 100 + placementBonus;
};

export const passLevelFromXp = (xp: number): { tier: number; progress: number; xpIntoTier: number } => {
  const clamped = Math.max(0, Math.floor(xp));
  const tier = Math.min(BATTLE_PASS.tierCount, Math.floor(clamped / BATTLE_PASS.xpPerTier) + 1);
  const xpIntoTier = tier > BATTLE_PASS.tierCount ? 0 : clamped - (tier - 1) * BATTLE_PASS.xpPerTier;
  return { tier, progress: xpIntoTier / BATTLE_PASS.xpPerTier, xpIntoTier };
};

export const passTierReward = (tier: number, premium: boolean): PassReward | null => {
  const t = PASS_TIERS.find((x) => x.tier === tier);
  if (!t) return null;
  return premium ? t.premium : t.free;
};

export const totalPassXpToComplete = (): number => BATTLE_PASS.tierCount * BATTLE_PASS.xpPerTier;

export const demoPassRng = (): Rng => new Rng(1);
