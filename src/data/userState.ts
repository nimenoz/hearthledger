import AsyncStorage from '@react-native-async-storage/async-storage';

export const SAVED_KEY = 'hearthledger/saved/v1';
export const SEEN_KEY = 'hearthledger/seen/v1';

/**
 * Parse a stored JSON array of ids. Returns null when nothing is stored, so callers can
 * tell "never set" apart from "set to empty". Corrupt or non-array values count as empty.
 */
export function parseIdList(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function loadIdSet(key: string): Promise<Set<string> | null> {
  try {
    const ids = parseIdList(await AsyncStorage.getItem(key));
    return ids === null ? null : new Set(ids);
  } catch {
    return new Set();
  }
}

export async function saveIdSet(key: string, ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // Storage is best-effort: losing a bookmark is preferable to crashing the screen.
  }
}
