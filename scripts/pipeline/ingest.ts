import type { ChangeEntry, Feed, NewsItem } from '../../src/data/types';
import type { CollectedNews, TrackerStats } from './parsers';

export interface ChangeLogEntry {
  kind: 'news-added' | 'news-removed' | 'change-updated';
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

const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december';
const MONTH_DAY = new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi');
/** Titles announcing that an event moved, e.g. "Blizzard Moves WoW: Forever Stress Test to October 21". */
const RESCHEDULE = /\b(moves?|moved|postpone[sd]?|rescheduled|delayed)\b/i;
/** Words too generic to identify an event on their own. */
const GENERIC = new Set([
  'a', 'an', 'and', 'announced', 'at', 'blizzard', 'by', 'for', 'in', 'instead', 'is', 'join', 'moves', 'moved',
  'of', 'on', 'previously', 'the', 'to', 'warcraft', 'with', 'world', 'wow',
]);

function eventWords(title: string): Set<string> {
  const words = title.replace(MONTH_DAY, ' ').toLowerCase().match(/[a-z]+/g) ?? [];
  return new Set(words.filter((w) => !GENERIC.has(w)));
}

function monthDays(title: string): string[] {
  return (title.match(MONTH_DAY) ?? []).map((d) => d.toLowerCase().replace(/\s+/g, ' ').replace(/(st|nd|rd|th)$/, ''));
}

/** True when `newer` is a reschedule notice for the same event as `older`, and gives a different date. */
function replacedBy(older: NewsItem, newer: NewsItem): boolean {
  if (older.id === newer.id || !RESCHEDULE.test(newer.title)) return false;
  // Without dates on both items, we cannot tell which notice is newer.
  if (!older.publishedAt || !newer.publishedAt || older.publishedAt > newer.publishedAt) return false;
  const olderWords = eventWords(older.title);
  const shared = [...eventWords(newer.title)].filter((w) => olderWords.has(w));
  if (shared.length < 2) return false;
  const newerDays = monthDays(newer.title);
  const olderDays = monthDays(older.title);
  return newerDays.length > 0 && olderDays.some((d) => !newerDays.includes(d));
}

/** IDs of news items replaced by a newer reschedule notice. Chains (A -> B -> C) remove both A and B. */
function findSuperseded(news: NewsItem[]): Set<string> {
  const superseded = new Set<string>();
  for (const older of news) {
    if (news.some((newer) => replacedBy(older, newer))) superseded.add(older.id);
  }
  return superseded;
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
  const candidates: NewsItem[] = [];

  for (const item of news) {
    const key = normalizeUrl(item.url);
    if (knownUrls.has(key)) continue;
    knownUrls.add(key);
    candidates.push({
      id: newsIdFor(item.url),
      title: item.title,
      summary: item.summary,
      url: item.url,
      sourceLabel: item.sourceLabel,
      publishedAt: item.publishedAt,
      official: item.official,
      tags: item.tags,
    });
  }

  // Drop items superseded by a newer reschedule notice, whether already in the feed or in this batch.
  const superseded = findSuperseded([...feed.news, ...candidates]);
  const keptNews = feed.news.filter((n) => !superseded.has(n.id));
  const addedNews = candidates.filter((n) => !superseded.has(n.id));
  for (const n of feed.news) {
    if (superseded.has(n.id)) log.push({ kind: 'news-removed', id: n.id, detail: `${n.sourceLabel}: ${n.title}` });
  }
  for (const n of addedNews) {
    log.push({ kind: 'news-added', id: n.id, detail: `${n.sourceLabel}: ${n.title}` });
  }

  let changes = feed.changes;
  if (stats.newItems !== undefined && stats.changedItems !== undefined) {
    changes = upsertChange(changes, 'item-count', itemCountText(stats.newItems, stats.changedItems), log);
  }
  if (stats.spellTalentChanges !== undefined) {
    changes = upsertChange(changes, 'spell-talent-count', spellTalentText(stats.spellTalentChanges), log);
  }

  if (log.length === 0) {
    return { feed, log };
  }

  return {
    feed: {
      version: feed.version + 1,
      updatedAt: now.toISOString().slice(0, 10),
      changes,
      news: [...keptNews, ...addedNews],
    },
    log,
  };
}
