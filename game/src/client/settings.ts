import { t, type Lang } from '../shared/i18n.js';

export type QualityLevel = 'bajo' | 'medio' | 'alto';
export type ColorblindMode = 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface Settings {
  lang: Lang;
  sensitivity: number;
  textScale: number;
  highContrast: boolean;
  subtitles: boolean;
  wings: boolean;
  keys: Record<string, string>;
  quality: QualityLevel;
  fpsCap: number;
  shadows: boolean;
  brightness: number;
  volMaster: number;
  volMusic: number;
  volSfx: number;
  colorblind: ColorblindMode;
  damageIndicators: boolean;
  region: string;
  dataSaver: boolean;
}

export const QUALITY_DPR_CAP: Record<QualityLevel, number> = {
  bajo: 1,
  medio: 1.5,
  alto: 3,
};

export const QUALITY_PARTICLES: Record<QualityLevel, number> = {
  bajo: 120,
  medio: 350,
  alto: 600,
};

export const REGIONS: Array<{ id: string; es: string; en: string }> = [
  { id: 'auto', es: 'Automático', en: 'Automatic' },
  { id: 'america-sur', es: 'América del Sur', en: 'South America' },
  { id: 'america-norte', es: 'América del Norte', en: 'North America' },
  { id: 'europa', es: 'Europa', en: 'Europe' },
  { id: 'asia', es: 'Asia', en: 'Asia' },
];

const DEFAULT_KEYS: Record<string, string> = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  reload: 'KeyR',
  pickup: 'KeyE',
  heal: 'KeyQ',
  shieldItem: 'KeyF',
  swap: 'Space',
  grenade: 'KeyG',
  ability: 'KeyC',
  slide: 'ShiftLeft',
  prone: 'KeyZ',
};

const STORAGE_KEY = 'nexo-settings-v1';

const clamp01 = (n: unknown, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;

export const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        lang: parsed.lang === 'en' ? 'en' : 'es',
        sensitivity: typeof parsed.sensitivity === 'number' ? parsed.sensitivity : 1,
        textScale: typeof parsed.textScale === 'number' ? parsed.textScale : 1,
        highContrast: parsed.highContrast === true,
        subtitles: parsed.subtitles !== false,
        wings: parsed.wings !== false,
        keys: { ...DEFAULT_KEYS, ...(parsed.keys ?? {}) },
        quality: parsed.quality === 'bajo' || parsed.quality === 'alto' ? parsed.quality : 'medio',
        fpsCap: typeof parsed.fpsCap === 'number' && parsed.fpsCap >= 30 ? parsed.fpsCap : 60,
        shadows: parsed.shadows !== false,
        brightness: clamp01(parsed.brightness, 1),
        volMaster: clamp01(parsed.volMaster, 0.8),
        volMusic: clamp01(parsed.volMusic, 0.6),
        volSfx: clamp01(parsed.volSfx, 1),
        colorblind:
          parsed.colorblind === 'protanopia' ||
          parsed.colorblind === 'deuteranopia' ||
          parsed.colorblind === 'tritanopia'
            ? parsed.colorblind
            : 'off',
        damageIndicators: parsed.damageIndicators !== false,
        region: typeof parsed.region === 'string' ? parsed.region : 'auto',
        dataSaver: parsed.dataSaver === true,
      };
    }
  } catch {
    // corrupted settings fall back to defaults
  }
  return {
    lang: 'es',
    sensitivity: 1,
    textScale: 1,
    highContrast: false,
    subtitles: true,
    wings: true,
    keys: { ...DEFAULT_KEYS },
    quality: 'medio',
    fpsCap: 60,
    shadows: true,
    brightness: 1,
    volMaster: 0.8,
    volMusic: 0.6,
    volSfx: 1,
    colorblind: 'off',
    damageIndicators: true,
    region: 'auto',
    dataSaver: false,
  };
};

export const saveSettings = (s: Settings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // storage may be unavailable (private mode)
  }
};

export const applySettingsToDom = (s: Settings): void => {
  document.documentElement.style.fontSize = `${16 * s.textScale}px`;
  document.body.classList.toggle('high-contrast', s.highContrast);
  document.documentElement.lang = s.lang;
  document.body.classList.remove('cb-protanopia', 'cb-deuteranopia', 'cb-tritanopia');
  if (s.colorblind !== 'off') document.body.classList.add(`cb-${s.colorblind}`);
};

export const applyI18n = (s: Settings): void => {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key, s.lang);
  });
};

export const keyLabel = (code: string): string =>
  code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code;
