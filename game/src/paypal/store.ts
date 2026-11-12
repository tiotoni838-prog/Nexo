/**
 * Catálogo de la tienda: SOLO cosméticos (spec maestra: sin pay-to-win,
 * sin cajas de botín pagadas, sin ventajas competitivas comprables).
 *
 * Doble moneda:
 *  - USD: moneda de pago (PayPal, server-side).
 *  - NX ("Nexos"): moneda que se gana jugando (kills, posición final).
 *    El saldo NX vive en el cliente (localStorage) hasta que existan
 *    cuentas persistentes con base de datos.
 */

export type StoreCurrency = 'USD' | 'NX';

export interface StoreItem {
  sku: string;
  nameEs: string;
  nameEn: string;
  priceUsd?: string;
  priceNx?: number;
  currency: StoreCurrency;
  kind: 'skin' | 'emote' | 'trail' | 'banner';
  rarity: 'raro' | 'epico' | 'legendario';
}

export const STORE_CATALOG: StoreItem[] = [
  {
    sku: 'skin-aurora-vanguard',
    nameEs: 'Skin: Vanguardia Aurora',
    nameEn: 'Skin: Aurora Vanguard',
    priceUsd: '4.99',
    currency: 'USD',
    kind: 'skin',
    rarity: 'epico',
  },
  {
    sku: 'skin-quartz-drifter',
    nameEs: 'Skin: Errante de Cuarzo',
    nameEn: 'Skin: Quartz Drifter',
    priceUsd: '2.99',
    currency: 'USD',
    kind: 'skin',
    rarity: 'raro',
  },
  {
    sku: 'trail-solar-flare',
    nameEs: 'Estela: Llamarada Solar',
    nameEn: 'Trail: Solar Flare',
    priceUsd: '1.99',
    currency: 'USD',
    kind: 'trail',
    rarity: 'raro',
  },
  {
    sku: 'emote-nexo-salute',
    nameEs: 'Gesto: Saludo Nexo',
    nameEn: 'Emote: Nexo Salute',
    priceUsd: '0.99',
    currency: 'USD',
    kind: 'emote',
    rarity: 'legendario',
  },
  {
    sku: 'nx-skin-centinela',
    nameEs: 'Skin: Centinela de Acero',
    nameEn: 'Skin: Steel Sentinel',
    priceNx: 800,
    currency: 'NX',
    kind: 'skin',
    rarity: 'raro',
  },
  {
    sku: 'nx-trail-chispas',
    nameEs: 'Estela: Chispas de Combate',
    nameEn: 'Trail: Combat Sparks',
    priceNx: 500,
    currency: 'NX',
    kind: 'trail',
    rarity: 'raro',
  },
  {
    sku: 'nx-banner-victoria',
    nameEs: 'Banner: Victoria Nexo',
    nameEn: 'Banner: Nexo Victory',
    priceNx: 300,
    currency: 'NX',
    kind: 'banner',
    rarity: 'epico',
  },
  {
    sku: 'nx-emote-baile',
    nameEs: 'Gesto: Baile del Nexo',
    nameEn: 'Emote: Nexo Dance',
    priceNx: 1200,
    currency: 'NX',
    kind: 'emote',
    rarity: 'legendario',
  },
];

export const findStoreItem = (sku: string): StoreItem | undefined =>
  STORE_CATALOG.find((i) => i.sku === sku);

export const NX_PER_KILL = 25;
export const NX_PER_PLACEMENT_BASE = 100;

export const computeMatchNxEarned = (kills: number, placement: number, totalPlayers: number): number => {
  const placementBonus = Math.max(0, totalPlayers - placement + 1) * 10;
  return kills * NX_PER_KILL + NX_PER_PLACEMENT_BASE + placementBonus;
};
