/**
 * Catálogo de la tienda: SOLO cosméticos (spec maestra: sin pay-to-win,
 * sin cajas de botín pagadas, sin ventajas competitivas comprables).
 * Precios en USD con valor exacto mostrado antes de confirmar.
 */

export interface StoreItem {
  sku: string;
  nameEs: string;
  nameEn: string;
  priceUsd: string;
  kind: 'skin' | 'emote' | 'trail';
  rarity: 'raro' | 'epico' | 'legendario';
}

export const STORE_CATALOG: StoreItem[] = [
  {
    sku: 'skin-aurora-vanguard',
    nameEs: 'Skin: Vanguardia Aurora',
    nameEn: 'Skin: Aurora Vanguard',
    priceUsd: '4.99',
    kind: 'skin',
    rarity: 'epico',
  },
  {
    sku: 'skin-quartz-drifter',
    nameEs: 'Skin: Errante de Cuarzo',
    nameEn: 'Skin: Quartz Drifter',
    priceUsd: '2.99',
    kind: 'skin',
    rarity: 'raro',
  },
  {
    sku: 'trail-solar-flare',
    nameEs: 'Estela: Llamarada Solar',
    nameEn: 'Trail: Solar Flare',
    priceUsd: '1.99',
    kind: 'trail',
    rarity: 'raro',
  },
  {
    sku: 'emote-nexo-salute',
    nameEs: 'Gesto: Saludo Nexo',
    nameEn: 'Emote: Nexo Salute',
    priceUsd: '0.99',
    kind: 'emote',
    rarity: 'legendario',
  },
];

export const findStoreItem = (sku: string): StoreItem | undefined =>
  STORE_CATALOG.find((i) => i.sku === sku);
