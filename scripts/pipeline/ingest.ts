import type { ChangeEntry, Feed, NewsItem } from '../../src/data/types';
import type { CollectedNews, TrackerStats } from './parsers';

export interface ChangeLogEntry {
  kind: 'news-added' | 'change-updated';
  id: string;
  detail: string;
}

export interface IngestResult {
  feed: Feed;
  log: ChangeLogEntry[];
}

/** FNV-1a 32-bit hash, rendered as 8 hex digits. Stable across runs and platforms. */
export function hashId(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return url.trim();
  }
}

export function newsIdFor(url: string): string {
  return `news-${hashId(normalizeUrl(url))}`;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export function itemCountText(newItems: number, changedItems: number): string {
  return `The beta build showed ${fmt(newItems)} new items and ${fmt(changedItems)} changed items.`;
}

export function spellTalentText(count: number): string {
  return `The beta build showed ${fmt(count)} talent and spell changes compared with Classic.`;
}

function upsertChange(changes: ChangeEntry[], id: string, forever: string, log: ChangeLogEntry[]): ChangeEntry[] {
  const existing = changes.find((c) => c.id === id);
  if (!existing) return changes;
  if (existing.forever === forever) return changes;
  log.push({ kind: 'change-updated', id, detail: `${existing.forever} -> ${forever}` });
  return changes.map((c) => (c.id === id ? { ...c, forever } : c));
}

/**
 * Merge collected items into a feed.
 * - News is deduplicated by normalised URL against the existing feed and within the batch.
 * - Tracker counts update the matching 'reported' change entries when they differ.
 * - The version is bumped only when something changed, so clients can skip no-op updates.
 */
export function ingest(feed: Feed, news: CollectedNews[], stats: TrackerStats, now: Date): IngestResult {
  const log: ChangeLogEntry[] = [];
  const knownUrls = new Set(feed.news.map((n) => normalizeUrl(n.url)));
  const addedNews: NewsItem[] = [];

  for (const item of news) {
    const key = normalizeUrl(item.url);
    if (knownUrls.has(key)) continue;
    knownUrls.add(key);
    const id = newsIdFor(item.url);
    addedNews.push({
      id,
      title: item.title,
      summary: item.summary,
      url: item.url,
      sourceLabel: item.sourceLabel,
      publishedAt: item.publishedAt,
      official: item.official,
      tags: item.tags,
    });
    log.push({ kind: 'news-added', id, detail: `${item.sourceLabel}: ${item.title}` });
  }

  let changes = feed.changes;
  if (stats.newItems !== undefined && stats.changedItems !== undefined) {
    changes = upsertChange(changes, 'item-count', itemCountText(stats.newItems, stats.changedItems), log);
  }
  if (stats.spellTalentChanges !== undefined) {
    changes = upsertChange(changes, 'spell-talent-count', spellTalentText(stats.spellTalentChanges), log);
  }

  if (addedNews.length === 0 && log.length === 0) {
    return { feed, log };
  }

  return {
    feed: {
      version: feed.version + 1,
      updatedAt: now.toISOString().slice(0, 10),
      changes,
      news: [...feed.news, ...addedNews],
    },
    log,
  };
}
