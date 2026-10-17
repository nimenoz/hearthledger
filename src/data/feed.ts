import AsyncStorage from '@react-native-async-storage/async-storage';

import { seedFeed } from './seed';
import type { ChangeEntry, Feed, NewsItem } from './types';

const CACHE_KEY = 'hearthledger/feed/v1';

export function isFeed(value: unknown): value is Feed {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.version === 'number' &&
    typeof v.updatedAt === 'string' &&
    Array.isArray(v.changes) &&
    Array.isArray(v.news)
  );
}

/** Merge by id. Items in `incoming` replace items with the same id; a higher version wins. */
export function mergeFeeds(base: Feed, incoming: Feed): Feed {
  const changes = new Map<string, ChangeEntry>();
  for (const c of base.changes) changes.set(c.id, c);
  for (const c of incoming.changes) changes.set(c.id, c);

  const news = new Map<string, NewsItem>();
  for (const n of base.news) news.set(n.id, n);
  for (const n of incoming.news) news.set(n.id, n);

  const newer = incoming.version >= base.version ? incoming : base;
  return {
    version: Math.max(base.version, incoming.version),
    updatedAt: newer.updatedAt,
    changes: [...changes.values()],
    news: [...news.values()].sort(newsSort),
  };
}

export function newsSort(a: NewsItem, b: NewsItem): number {
  // Newest first; items without a date keep their feed order at the end.
  if (a.publishedAt && b.publishedAt) return b.publishedAt.localeCompare(a.publishedAt);
  if (a.publishedAt) return -1;
  if (b.publishedAt) return 1;
  return 0;
}

export interface LoadedFeed {
  feed: Feed;
  origin: 'bundled' | 'cache' | 'remote';
  error?: string;
}

/** Read the cached remote feed, if any, merged over the bundled seed. */
export async function loadCachedFeed(): Promise<LoadedFeed> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isFeed(parsed)) return { feed: mergeFeeds(seedFeed, parsed), origin: 'cache' };
    }
  } catch {
    // Corrupt cache: fall through to the bundled seed.
  }
  return { feed: seedFeed, origin: 'bundled' };
}

/**
 * Fetch the remote feed (EXPO_PUBLIC_FEED_URL). Only replaces the cache when the payload is valid.
 * Returns the merged feed; on any failure the current feed is returned with an error message.
 */
export async function refreshFeed(
  current: Feed,
  currentOrigin: LoadedFeed['origin'],
  timeoutMs = 8000,
): Promise<LoadedFeed> {
  const url = process.env.EXPO_PUBLIC_FEED_URL;
  if (!url) return { feed: current, origin: currentOrigin };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
    const payload: unknown = await res.json();
    if (!isFeed(payload)) throw new Error('Feed payload has an unexpected shape');
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    return { feed: mergeFeeds(seedFeed, payload), origin: 'remote' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Feed refresh failed';
    return { feed: current, origin: currentOrigin, error: message };
  } finally {
    clearTimeout(timer);
  }
}
