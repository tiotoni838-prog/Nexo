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

export type StoreCurrency = 'USD' | 'NX' | 'DALO';

export interface StoreItem {
  sku: string;
  nameEs: string;
  nameEn: string;
  priceUsd?: string;
  priceNx?: number;
  priceDalos?: number;
  currency: StoreCurrency;
  kind: 'skin' | 'emote' | 'trail' | 'banner' | 'spray' | 'paracaidas' | 'marco' | 'insignia' | 'mascota' | 'dalo-pack';
  rarity: 'raro' | 'epico' | 'legendario';
}

/**
 * Monedas del juego:
 *  - DALOS (◆ azules): moneda de PAGO. Se compran con PayPal en paquetes.
 *  - NX (◆ doradas): moneda que se GANA jugando (kills, posición final).
 * Todos los artículos son cosméticos: sin pay-to-win.
 */
export const DALO_PACKS: StoreItem[] = [
  {
    sku: 'dalo-100',
    nameEs: '100 Dalos',
    nameEn: '100 Dalos',
    priceUsd: '0.99',
    currency: 'USD',
    kind: 'dalo-pack',
    rarity: 'raro',
  },
  {
    sku: 'dalo-550',
    nameEs: '550 Dalos (+50 bono)',
    nameEn: '550 Dalos (+50 bonus)',
    priceUsd: '4.99',
    currency: 'USD',
    kind: 'dalo-pack',
    rarity: 'epico',
  },
  {
    sku: 'dalo-1200',
    nameEs: '1.200 Dalos (+200 bono)',
    nameEn: '1,200 Dalos (+200 bonus)',
    priceUsd: '9.99',
    currency: 'USD',
    kind: 'dalo-pack',
    rarity: 'epico',
  },
  {
    sku: 'dalo-2500',
    nameEs: '2.500 Dalos (+600 bono)',
    nameEn: '2,500 Dalos (+600 bonus)',
    priceUsd: '19.99',
    currency: 'USD',
    kind: 'dalo-pack',
    rarity: 'legendario',
  },
];

export const DALO_PACK_AMOUNTS: Record<string, number> = {
  'dalo-100': 100,
  'dalo-550': 600,
  'dalo-1200': 1400,
  'dalo-2500': 3100,
};

export const daloPackAmount = (sku: string): number => DALO_PACK_AMOUNTS[sku] ?? 0;

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
  {
    sku: 'dalo-skin-fenix',
    nameEs: 'Skin: Fénix de Dalos',
    nameEn: 'Skin: Dalos Phoenix',
    priceDalos: 400,
    currency: 'DALO',
    kind: 'skin',
    rarity: 'epico',
  },
  {
    sku: 'dalo-trail-cometa',
    nameEs: 'Estela: Cola de Cometa',
    nameEn: 'Trail: Comet Tail',
    priceDalos: 250,
    currency: 'DALO',
    kind: 'trail',
    rarity: 'raro',
  },
  {
    sku: 'dalo-emote-leyenda',
    nameEs: 'Gesto: Reverencia Legendaria',
    nameEn: 'Emote: Legendary Bow',
    priceDalos: 600,
    currency: 'DALO',
    kind: 'emote',
    rarity: 'legendario',
  },
  {
    sku: 'nx-spray-nexo',
    nameEs: 'Spray: Logotipo Nexo',
    nameEn: 'Spray: Nexo Logo',
    priceNx: 250,
    currency: 'NX',
    kind: 'spray',
    rarity: 'raro',
  },
  {
    sku: 'dalo-spray-dragon',
    nameEs: 'Spray: Dragón de Dalos',
    nameEn: 'Spray: Dalos Dragon',
    priceDalos: 180,
    currency: 'DALO',
    kind: 'spray',
    rarity: 'epico',
  },
  {
    sku: 'nx-paracaidas-aurora',
    nameEs: 'Paracaídas: Aurora',
    nameEn: 'Parachute: Aurora',
    priceNx: 700,
    currency: 'NX',
    kind: 'paracaidas',
    rarity: 'epico',
  },
  {
    sku: 'dalo-paracaidas-fenix',
    nameEs: 'Paracaídas: Fénix Ardiente',
    nameEn: 'Parachute: Blazing Phoenix',
    priceDalos: 320,
    currency: 'DALO',
    kind: 'paracaidas',
    rarity: 'legendario',
  },
  {
    sku: 'nx-marco-bronce',
    nameEs: 'Marco: Bronce Nexo',
    nameEn: 'Frame: Nexo Bronze',
    priceNx: 200,
    currency: 'NX',
    kind: 'marco',
    rarity: 'raro',
  },
  {
    sku: 'dalo-marco-diamante',
    nameEs: 'Marco: Diamante Puro',
    nameEn: 'Frame: Pure Diamond',
    priceDalos: 280,
    currency: 'DALO',
    kind: 'marco',
    rarity: 'epico',
  },
  {
    sku: 'nx-insignia-lobo',
    nameEs: 'Insignia: Lobo de Acero',
    nameEn: 'Badge: Steel Wolf',
    priceNx: 350,
    currency: 'NX',
    kind: 'insignia',
    rarity: 'raro',
  },
  {
    sku: 'dalo-insignia-corona',
    nameEs: 'Insignia: Corona Nexo',
    nameEn: 'Badge: Nexo Crown',
    priceDalos: 450,
    currency: 'DALO',
    kind: 'insignia',
    rarity: 'legendario',
  },
  {
    sku: 'nx-mascota-dron',
    nameEs: 'Mascota: Dron Chispa',
    nameEn: 'Pet: Spark Drone',
    priceNx: 900,
    currency: 'NX',
    kind: 'mascota',
    rarity: 'epico',
  },
  {
    sku: 'dalo-mascota-fenix',
    nameEs: 'Mascota: Fénix Bebé',
    nameEn: 'Pet: Baby Phoenix',
    priceDalos: 500,
    currency: 'DALO',
    kind: 'mascota',
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
