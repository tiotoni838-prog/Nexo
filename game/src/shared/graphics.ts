/**
 * Gráficos y presentación: presets de calidad, ciclo día/noche, indicadores
 * de daño, rarezas con paletas daltónicas, cuadrícula del mapa y filtros.
 * Lógica pura e isomórfica: testeable en Node, usable en cliente y servidor.
 */

export type QualityPreset = 'baja' | 'media' | 'alta' | 'ultra';

export interface QualitySpec {
  dprCap: number;
  particles: number;
  shadows: boolean;
  fpsTarget: number;
}

export const QUALITY_PRESETS: Record<QualityPreset, QualitySpec> = {
  baja: { dprCap: 1, particles: 120, shadows: false, fpsTarget: 30 },
  media: { dprCap: 1.5, particles: 350, shadows: true, fpsTarget: 60 },
  alta: { dprCap: 2, particles: 500, shadows: true, fpsTarget: 60 },
  ultra: { dprCap: 3, particles: 600, shadows: true, fpsTarget: 120 },
};

export const normalizeQuality = (value: string | undefined): QualityPreset => {
  if (value === 'baja' || value === 'media' || value === 'alta' || value === 'ultra') return value;
  if (value === 'bajo') return 'baja';
  if (value === 'alto') return 'ultra';
  return 'media';
};

/* ===== Ciclo día / noche ===== */

export type DayPhase = 'dia' | 'atardecer' | 'noche' | 'amanecer';

export interface TimeOfDay {
  phase: DayPhase;
  sky: string;
  darkness: number;
}

export const DEFAULT_DAY_CYCLE_MS = 8 * 60_000;

export const timeOfDay = (elapsedMs: number, cycleMs = DEFAULT_DAY_CYCLE_MS): TimeOfDay => {
  const t = ((((elapsedMs % cycleMs) + cycleMs) % cycleMs) / cycleMs);
  if (t < 0.4) return { phase: 'dia', sky: '#7fb2e5', darkness: 0 };
  if (t < 0.5) return { phase: 'atardecer', sky: '#e58f5a', darkness: 0.15 };
  if (t < 0.9) return { phase: 'noche', sky: '#0a0e1f', darkness: 0.45 };
  return { phase: 'amanecer', sky: '#d9a06b', darkness: 0.15 };
};

/* ===== Indicadores de daño ===== */

/** Ángulo (radianes) de la flecha de daño respecto a la pantalla (0 = arriba). */
export const damageAngle = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  playerAim: number,
): number => {
  const world = Math.atan2(fromY - toY, fromX - toX);
  return world - playerAim - Math.PI / 2;
};

/* ===== Rarezas ===== */

export const RARITY_COLORS: Record<string, string> = {
  comun: '#9aa3ad',
  'poco-comun': '#4caf50',
  raro: '#3d8bff',
  epico: '#b06bff',
  legendario: '#f2b632',
  mitico: '#ff4d5e',
};

export const COLORBLIND_RARITY_COLORS: Record<string, Record<string, string>> = {
  protanopia: { comun: '#9aa3ad', 'poco-comun': '#d4c94a', raro: '#4ac0e8', epico: '#e8e84a', legendario: '#ffffff', mitico: '#e84a4a' },
  deuteranopia: { comun: '#9aa3ad', 'poco-comun': '#e0d24a', raro: '#4ac0e8', epico: '#f0f04a', legendario: '#ffffff', mitico: '#e8604a' },
  tritanopia: { comun: '#9aa3ad', 'poco-comun': '#4ad0b0', raro: '#e05a8a', epico: '#4ab8e0', legendario: '#f0e0e8', mitico: '#e04a6a' },
};

export const rarityColor = (rarity: string, colorblind: string = 'off'): string => {
  if (colorblind !== 'off') {
    return COLORBLIND_RARITY_COLORS[colorblind]?.[rarity] ?? RARITY_COLORS[rarity] ?? RARITY_COLORS.comun!;
  }
  return RARITY_COLORS[rarity] ?? RARITY_COLORS.comun!;
};

/* ===== Cuadrícula del mapa (estilo "estoy en C4") ===== */

const COLS = 8;

export const gridLabel = (x: number, y: number, worldRadius: number): string => {
  const span = (2 * worldRadius) / COLS;
  const col = Math.min(COLS - 1, Math.max(0, Math.floor((x + worldRadius) / span)));
  const row = Math.min(COLS - 1, Math.max(0, Math.floor((y + worldRadius) / span)));
  return `${String.fromCharCode(65 + col)}${row + 1}`;
};

/* ===== Filtros de color ===== */

export type ColorFilter = 'off' | 'calido' | 'frio' | 'bn';

export const FILTER_CSS: Record<ColorFilter, string> = {
  off: '',
  calido: 'sepia(0.25) saturate(1.2)',
  frio: 'hue-rotate(15deg) saturate(1.1)',
  bn: 'grayscale(1)',
};

export const canvasFilter = (brightness: number, filter: ColorFilter): string => {
  const parts: string[] = [];
  if (brightness !== 1) parts.push(`brightness(${brightness})`);
  const f = FILTER_CSS[filter];
  if (f) parts.push(f);
  return parts.join(' ') || 'none';
};
