import { t } from '../shared/i18n.js';
import type { Lang } from '../shared/i18n.js';

/**
 * Cuentas: registro/login contra /api/auth, sesión en localStorage,
 * perfil y verificación en dos pasos (TOTP). Si el servidor no tiene
 * cuentas activadas (NEXO_DATA_DIR), el juego funciona igual en local.
 */

const TOKEN_KEY = 'nexo_auth_token';
const PROFILE_KEY = 'nexo_auth_profile';

export interface AuthProfile {
  id: string;
  email: string;
  name: string;
  avatarId?: string;
  totpEnabled: boolean;
  banned: boolean;
  stats: Record<string, number>;
  clanId: string | null;
  vipUntilMs: number;
}

export const authToken = (): string => localStorage.getItem(TOKEN_KEY) ?? '';
export const authProfile = (): AuthProfile | null => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as AuthProfile) : null;
  } catch {
    return null;
  }
};

const saveSession = (token: string, profile: AuthProfile): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

export const authHeaders = (): Record<string, string> => {
  const token = authToken();
  return token ? { authorization: `Bearer ${token}` } : {};
};

export const clearSession = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
};

export interface AuthResult {
  ok: boolean;
  error?: string;
  totpRequired?: boolean;
}

const post = async (path: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as Record<string, unknown> };
};

const errText = (code: string | undefined, lang: Lang): string => {
  const map: Record<string, { es: string; en: string }> = {
    'invalid-credentials': { es: 'Correo o contraseña incorrectos', en: 'Wrong email or password' },
    'totp-required': { es: 'Introduce tu código de 2 pasos', en: 'Enter your 2FA code' },
    'totp-invalid': { es: 'Código de 2 pasos inválido', en: 'Invalid 2FA code' },
    'account-banned': { es: 'Cuenta baneada', en: 'Account banned' },
    'email-taken': { es: 'Ese correo ya está registrado', en: 'Email already registered' },
    'name-taken': { es: 'Ese nombre ya existe', en: 'Name already taken' },
    'invalid-email': { es: 'Correo inválido', en: 'Invalid email' },
    'password-too-short': { es: 'La contraseña necesita 8+ caracteres', en: 'Password needs 8+ characters' },
    'accounts-not-configured': { es: 'Este servidor no tiene cuentas activadas', en: 'This server has no accounts enabled' },
    unauthorized: { es: 'Sesión expirada', en: 'Session expired' },
  };
  const entry = code ? map[code] : undefined;
  if (entry) return entry[lang];
  return lang === 'es' ? 'Error de conexión' : 'Connection error';
};

export const login = async (email: string, password: string, totpCode: string | null, lang: Lang): Promise<AuthResult> => {
  try {
    const { status, data } = await post('/api/auth/login', { email, password, totpCode });
    if (status === 200 && typeof data.token === 'string' && data.account) {
      saveSession(data.token, data.account as AuthProfile);
      return { ok: true };
    }
    return { ok: false, error: errText(data.error as string | undefined, lang), totpRequired: data.error === 'totp-required' };
  } catch {
    return { ok: false, error: errText(undefined, lang) };
  }
};

export const register = async (email: string, password: string, name: string, lang: Lang): Promise<AuthResult> => {
  try {
    const { status, data } = await post('/api/auth/register', { email, password, name });
    if (status === 201 && typeof data.token === 'string' && data.account) {
      saveSession(data.token, data.account as AuthProfile);
      return { ok: true };
    }
    return { ok: false, error: errText(data.error as string | undefined, lang) };
  } catch {
    return { ok: false, error: errText(undefined, lang) };
  }
};

export const logout = async (): Promise<void> => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() });
  } catch {
    // offline: clear locally anyway
  }
  clearSession();
};

export const fetchProfile = async (): Promise<AuthProfile | null> => {
  if (!authToken()) return null;
  try {
    const res = await fetch('/api/profile', { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401) clearSession();
      return null;
    }
    const data = (await res.json()) as { account: AuthProfile };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data.account));
    return data.account;
  } catch {
    return null;
  }
};

/** Renderiza la pantalla de login/registro dentro de #auth. */
export const initAuthScreen = (lang: () => Lang, onAuthed: () => void): void => {
  const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
  const $input = (id: string): HTMLInputElement => document.getElementById(id) as HTMLInputElement;
  const screen = $('auth');
  const show = (visible: boolean): void => {
    screen.classList.toggle('hidden', !visible);
  };

  const refresh = (): void => {
    const profile = authProfile();
    if (profile) {
      $('authChipName').textContent = profile.name;
      $('authChip').classList.remove('hidden');
    } else {
      $('authChip').classList.add('hidden');
    }
  };
  refresh();

  const msg = (text: string): void => {
    $('authMsg').textContent = text;
  };

  const doLogin = async (): Promise<void> => {
    msg('…');
    const res = await login(
      $input('authEmail').value.trim(),
      $input('authPass').value,
      $input('authTotp').value.trim() || null,
      lang(),
    );
    if (res.ok) {
      msg('');
      onAuthed();
      refresh();
    } else {
      msg(res.error ?? '');
      if (res.totpRequired) $('authTotpRow').classList.remove('hidden');
    }
  };

  const doRegister = async (): Promise<void> => {
    msg('…');
    const res = await register($input('authEmail').value.trim(), $input('authPass').value, $input('authName').value.trim() || 'Jugador', lang());
    if (res.ok) {
      msg('');
      onAuthed();
      refresh();
    } else {
      msg(res.error ?? '');
    }
  };

  const doLogout = async (): Promise<void> => {
    await logout();
    refresh();
  };

  $('btnAuthLogin').addEventListener('click', () => void doLogin());
  $('btnAuthRegister').addEventListener('click', () => void doRegister());
  $('btnAuthLogout').addEventListener('click', () => {
    void doLogout();
    show(false);
  });
  $('authChipLogout').addEventListener('click', () => void doLogout());
  $('btnBackAuth').addEventListener('click', () => show(false));
  $('btnAccount').addEventListener('click', () => {
    show(true);
    const profile = authProfile();
    $('btnAuthLogout').classList.toggle('hidden', !profile);
  });
  refresh();
};
