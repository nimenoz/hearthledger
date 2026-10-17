import * as SecureStore from 'expo-secure-store';

import type { Session } from './types';

const KEY = 'forever_codex_battlenet_session';

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

/** Returns the stored session, or null if missing, corrupt or expired. Expired sessions are removed. */
export async function loadSession(now: number = Date.now()): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed)) {
      await clearSession();
      return null;
    }
    if (parsed.expiresAt <= now) {
      await clearSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

function isSession(v: unknown): v is Session {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.accessToken === 'string' &&
    typeof s.expiresAt === 'number' &&
    (s.region === 'us' || s.region === 'eu' || s.region === 'kr' || s.region === 'tw')
  );
}
