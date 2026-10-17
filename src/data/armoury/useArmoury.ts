import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';

import { buildAuthorizeUrl, fetchCharacterDetail, fetchCharacterList, isAuthExpired, parseAuthFragment } from './battlenet';
import { clearSession, loadSession, saveSession } from './session';
import type { CharacterDetail, CharacterSummary, Region, Session } from './types';

/** Deep link the sign-in browser returns to. Must match the app scheme in app.json. */
export const RETURN_URL = 'hearthledger://armoury';

const EXPIRED_MESSAGE = 'Your Battle.net sign-in has expired. Sign in again to refresh your characters.';

function requireConfig(): { clientId: string; callbackUrl: string } {
  const clientId = process.env.EXPO_PUBLIC_BATTLENET_CLIENT_ID;
  const callbackUrl = process.env.EXPO_PUBLIC_ARMOURY_CALLBACK_URL;
  if (!clientId || !callbackUrl) {
    throw new Error('Armoury is not configured. Set EXPO_PUBLIC_BATTLENET_CLIENT_ID and EXPO_PUBLIC_ARMOURY_CALLBACK_URL.');
  }
  return { clientId, callbackUrl };
}

/** Opens Battle.net sign-in in the system browser and resolves to a stored session. */
export async function signInWithBattleNet(region: Region): Promise<Session> {
  const { clientId, callbackUrl } = requireConfig();
  const state = Array.from(await Crypto.getRandomBytesAsync(16), (b) => b.toString(16).padStart(2, '0')).join('');
  const authUrl = buildAuthorizeUrl({ clientId, redirectUri: callbackUrl, state });

  const result = await WebBrowser.openAuthSessionAsync(authUrl, RETURN_URL);
  if (result.type !== 'success') throw new Error('Sign-in was cancelled.');

  const parsed = parseAuthFragment(result.url, state);
  if (!parsed.ok) throw new Error(parsed.error);

  const session: Session = {
    accessToken: parsed.accessToken,
    expiresAt: Date.now() + parsed.expiresIn * 1000,
    region,
  };
  await saveSession(session);
  return session;
}

export function useArmoury() {
  const [session, setSession] = useState<Session | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSession().then((s) => {
      if (cancelled) return;
      setSession(s);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const expireSession = useCallback(async () => {
    await clearSession();
    setSession(null);
    setCharacters([]);
    setError(EXPIRED_MESSAGE);
  }, []);

  const signIn = useCallback(async (region: Region) => {
    setError(null);
    setLoading(true);
    try {
      setSession(await signInWithBattleNet(region));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setSession(null);
    setCharacters([]);
    setError(null);
  }, []);

  const loadCharacters = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setCharacters(await fetchCharacterList(session.region, session.accessToken));
    } catch (err) {
      if (isAuthExpired(err)) await expireSession();
      else setError(err instanceof Error ? err.message : 'Could not load characters.');
    } finally {
      setLoading(false);
    }
  }, [session, expireSession]);

  return { session, characters, ready, loading, error, signIn, signOut, loadCharacters, expireSession };
}

type DetailResult = { key: string; detail: CharacterDetail | null; error: string | null };

/**
 * Loading is derived: a request is pending until a result is stored for its key.
 * Results are only written from async callbacks, so the effect never sets state synchronously.
 */
export function useCharacterDetail(session: Session | null, realmSlug: string, name: string) {
  const [result, setResult] = useState<DetailResult | null>(null);
  const requestKey = session ? `${session.region}:${session.accessToken}:${realmSlug}:${name}` : null;

  useEffect(() => {
    if (!session || !requestKey) return;
    let cancelled = false;
    fetchCharacterDetail(session.region, session.accessToken, { realmSlug, name })
      .then((d) => {
        if (!cancelled) setResult({ key: requestKey, detail: d, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = isAuthExpired(err)
          ? 'Your Battle.net sign-in has expired. Sign in again from the Armoury tab.'
          : err instanceof Error
            ? err.message
            : 'Could not load this character.';
        setResult({ key: requestKey, detail: null, error: message });
      });
    return () => {
      cancelled = true;
    };
  }, [session, requestKey, realmSlug, name]);

  const current = result !== null && result.key === requestKey ? result : null;
  return {
    detail: current?.detail ?? null,
    loading: requestKey !== null && current === null,
    error: current?.error ?? null,
  };
}
