import { t, type Lang } from '../shared/i18n.js';

export interface Settings {
  lang: Lang;
  sensitivity: number;
  textScale: number;
  highContrast: boolean;
  subtitles: boolean;
  keys: Record<string, string>;
}

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
};

const STORAGE_KEY = 'nexo-settings-v1';

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
        keys: { ...DEFAULT_KEYS, ...(parsed.keys ?? {}) },
      };
    }
  } catch {
    // corrupted settings fall back to defaults
  }
  return { lang: 'es', sensitivity: 1, textScale: 1, highContrast: false, subtitles: true, keys: { ...DEFAULT_KEYS } };
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
};

export const applyI18n = (s: Settings): void => {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key, s.lang);
  });
};

export const keyLabel = (code: string): string =>
  code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code;
