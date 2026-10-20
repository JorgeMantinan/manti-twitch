import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';
import { API_CONFIG } from '../constants/api';

const TOKEN_KEY = 'userToken';
const REFRESH_THRESHOLD_SECONDS = 15 * 24 * 60 * 60;

export async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(TOKEN_KEY);
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveStoredToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {}
}

export function decodeToken(token: string): any | null {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string): Promise<string | null> {
  try {
    const res = await fetch(API_CONFIG.ENDPOINTS.AUTH_EXCHANGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.token === 'string' ? data.token : null;
  } catch {
    return null;
  }
}

export async function ensureFreshToken(): Promise<string | null> {
  const token = await getStoredToken();
  if (!token) return null;

  const decoded = decodeToken(token);
  if (!decoded?.exp) return token;

  const remaining = decoded.exp - Date.now() / 1000;
  if (remaining > REFRESH_THRESHOLD_SECONDS) return token;

  try {
    const res = await fetch(API_CONFIG.ENDPOINTS.AUTH_REFRESH, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      if (typeof data.token === 'string') {
        await saveStoredToken(data.token);
        return data.token;
      }
      return token;
    }

    if (res.status === 401 || res.status === 403) {
      await clearStoredToken();
      return null;
    }

    return token;
  } catch {
    return token;
  }
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Force a Twitch token rotation + new app JWT. Shared promise so parallel
 * 401s (e.g. FollowsCheck firing two requests at once) only trigger ONE
 * refresh call. If another tab already refreshed, re-reads storage before
 * ever clearing the token.
 */
export async function forceRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const current = await getStoredToken();
    if (!current) return null;

    try {
      const res = await fetch(API_CONFIG.ENDPOINTS.AUTH_REFRESH, {
        method: "POST",
        headers: { Authorization: `Bearer ${current}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (typeof data.token === "string") {
          await saveStoredToken(data.token);
          return data.token;
        }
        return current;
      }

      if (res.status === 401 || res.status === 403) {
        // Another tab may have rotated already — re-read before clearing
        const latest = await getStoredToken();
        if (latest && latest !== current) return latest;
        await clearStoredToken();
        return null;
      }

      return current;
    } catch {
      return current;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * fetch() wrapper: if the backend answers 401 (Twitch access token expired),
 * rotates the Twitch tokens via /auth/refresh and retries ONCE with the new
 * Bearer token. This keeps the app JWT alive for its full 30 days no matter
 * how often the embedded Twitch token (≈1h) expires.
 */
export async function apiFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const doFetch = (token?: string) => {
    if (!token) return fetch(url, init);
    const headers = new Headers(init?.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  const res = await doFetch();
  if (res.status !== 401) return res;

  const newToken = await forceRefresh();
  if (!newToken || newToken === extractBearer(init)) return res;
  return doFetch(newToken);
}

function extractBearer(init?: RequestInit): string | null {
  const auth = new Headers(init?.headers || {}).get("Authorization");
  return auth ? auth.replace(/^Bearer\s+/i, "") : null;
}
