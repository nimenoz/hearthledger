import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { loadCachedFeed, refreshFeed } from './feed';
import { seedFeed } from './seed';
import type { Feed } from './types';
import { loadIdSet, saveIdSet, SAVED_KEY, SEEN_KEY } from './userState';

interface FeedState {
  feed: Feed;
  origin: 'bundled' | 'cache' | 'remote';
  refreshing: boolean;
  error?: string;
  refresh: () => Promise<void>;
  /** Change ids the user has bookmarked. */
  saved: Set<string>;
  toggleSaved: (id: string) => void;
  /** Change ids the user has already seen. Anything else in the feed is "new". */
  seen: Set<string>;
  markSeen: (ids: string[]) => void;
}

const FeedContext = createContext<FeedState | null>(null);

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const [feed, setFeed] = useState<Feed>(seedFeed);
  const [origin, setOrigin] = useState<FeedState['origin']>('bundled');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  // Persist only after the stored values have been read, so an early render cannot overwrite them.
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const result = await refreshFeed(feed, origin);
    setFeed(result.feed);
    setOrigin(result.origin);
    setError(result.error);
    setRefreshing(false);
  }, [feed, origin]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await loadCachedFeed();
      const [savedIds, seenIds] = await Promise.all([loadIdSet(SAVED_KEY), loadIdSet(SEEN_KEY)]);
      if (cancelled) return;
      setFeed(cached.feed);
      setOrigin(cached.origin);
      setSaved(savedIds ?? new Set());
      // First launch: treat the current feed as already seen so nothing is flagged "new" on install.
      setSeen(seenIds ?? new Set(cached.feed.changes.map((c) => c.id)));
      setHydrated(true);

      const result = await refreshFeed(cached.feed, cached.origin);
      if (cancelled) return;
      setFeed(result.feed);
      setOrigin(result.origin);
      setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) void saveIdSet(SAVED_KEY, saved);
  }, [hydrated, saved]);

  useEffect(() => {
    if (hydrated) void saveIdSet(SEEN_KEY, seen);
  }, [hydrated, seen]);

  const toggleSaved = useCallback((id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const markSeen = useCallback((ids: string[]) => {
    setSeen((prev) => {
      if (ids.every((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ feed, origin, refreshing, error, refresh, saved, toggleSaved, seen, markSeen }),
    [feed, origin, refreshing, error, refresh, saved, toggleSaved, seen, markSeen],
  );
  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed(): FeedState {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeed must be used inside <FeedProvider>');
  return ctx;
}
