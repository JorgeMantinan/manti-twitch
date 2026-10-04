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
