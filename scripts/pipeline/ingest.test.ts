import { describe, expect, it } from 'vitest';

import type { NewsItem } from '../../src/data/types';
import { seedFeed } from '../../src/data/seed';
import { hashId, ingest, newsIdFor, normalizeUrl } from './ingest';
import type { CollectedNews } from './parsers';

const now = new Date('2026-10-18T06:00:00Z');
const noStats = {};

function item(url: string, title = 'Forever news item'): CollectedNews {
  return { url, title, summary: '', publishedAt: '2026-10-18', sourceLabel: 'Test', official: false, tags: [] };
}

describe('normalizeUrl and newsIdFor', () => {
  it('ignores case in the host, www, trailing slashes and fragments', () => {
    expect(normalizeUrl('https://WWW.Example.com/a/b/#top')).toBe('https://example.com/a/b');
    expect(newsIdFor('https://example.com/a/')).toBe(newsIdFor('https://EXAMPLE.com/a'));
  });

  it('produces stable 8-digit hashes', () => {
    expect(hashId('abc')).toBe(hashId('abc'));
    expect(hashId('abc')).toMatch(/^[0-9a-f]{8}$/);
    expect(hashId('abc')).not.toBe(hashId('abd'));
  });
});

describe('ingest', () => {
  it('returns the same feed object and no log when nothing is new', () => {
    const result = ingest(seedFeed, [], noStats, now);
    expect(result.feed).toBe(seedFeed);
    expect(result.log).toEqual([]);
  });

  it('adds new news once and skips URLs already in the feed or repeated in the batch', () => {
    const existing = seedFeed.news[0].url;
    const batch = [
      item('https://example.com/new-1'),
      item('https://example.com/new-1/'),
      item(existing),
      item('https://example.com/new-2'),
    ];
    const result = ingest(seedFeed, batch, noStats, now);
    const added = result.feed.news.slice(seedFeed.news.length);
    expect(added.map((n) => n.url)).toEqual(['https://example.com/new-1', 'https://example.com/new-2']);
    expect(result.log.filter((l) => l.kind === 'news-added')).toHaveLength(2);
    expect(result.feed.version).toBe(seedFeed.version + 1);
    expect(result.feed.updatedAt).toBe('2026-10-18');
  });

  it('updates tracker counts only when they differ and logs the change', () => {
    const same = ingest(seedFeed, [], { newItems: 5594, changedItems: 4581, spellTalentChanges: 759 }, now);
    expect(same.feed).toBe(seedFeed);

    const changed = ingest(seedFeed, [], { newItems: 6000, changedItems: 4600, spellTalentChanges: 800 }, now);
    const itemCount = changed.feed.changes.find((c) => c.id === 'item-count');
    expect(itemCount?.forever).toBe('The beta build showed 6,000 new items and 4,600 changed items.');
    expect(itemCount?.status).toBe('reported');
    expect(changed.feed.changes.find((c) => c.id === 'spell-talent-count')?.forever).toContain('800 talent');
    expect(changed.log.filter((l) => l.kind === 'change-updated')).toHaveLength(2);
    expect(changed.feed.version).toBe(seedFeed.version + 1);
  });

  it('does not invent change entries that are not in the seed', () => {
    const result = ingest(seedFeed, [], { newItems: 1, changedItems: 2, spellTalentChanges: 3 }, now);
    expect(result.feed.changes.length).toBe(seedFeed.changes.length);
  });
});

describe('superseded news', () => {
  const notice = (id: string, title: string, publishedAt: string): NewsItem => ({
    id,
    title,
    summary: '',
    url: `https://www.wowhead.com/news=${id}`,
    sourceLabel: 'Wowhead',
    publishedAt,
    official: false,
    tags: ['news'],
  });
  const oldDate = notice('news-old', 'Join the World of Warcraft: Forever Stress Test on October 19th', '2026-10-15');
  const moved = notice('news-moved', 'Blizzard Moves WoW: Forever Stress Test to October 21', '2026-10-16');
  const feedWith = (news: NewsItem[]) => ({ ...seedFeed, news });

  it('removes an older notice when a newer reschedule for the same event is in the batch', () => {
    const base = feedWith([oldDate]);
    const incoming: CollectedNews = { title: moved.title, url: moved.url, summary: '', sourceLabel: 'Wowhead', publishedAt: moved.publishedAt, official: false, tags: ['news'] };
    const result = ingest(base, [incoming], noStats, now);
    expect(result.feed.news.map((n) => n.title)).toEqual([moved.title]);
    expect(result.log).toContainEqual(expect.objectContaining({ kind: 'news-removed', id: 'news-old' }));
    expect(result.feed.version).toBe(seedFeed.version + 1);
  });

  it('removes an older notice already in the feed when the reschedule is already stored', () => {
    const result = ingest(feedWith([oldDate, moved]), [], noStats, now);
    expect(result.feed.news.map((n) => n.id)).toEqual(['news-moved']);
    expect(result.log.filter((l) => l.kind === 'news-removed')).toHaveLength(1);
  });

  it('does not re-add a superseded notice that the source still lists', () => {
    const base = feedWith([moved]);
    const result = ingest(base, [{ title: oldDate.title, url: oldDate.url, summary: '', sourceLabel: 'Wowhead', publishedAt: oldDate.publishedAt, official: false, tags: ['news'] }], noStats, now);
    expect(result.feed).toBe(base);
    expect(result.log).toEqual([]);
  });

  it('keeps notices with the same date or without a reschedule verb', () => {
    const sameDate = notice('news-same', 'Forever Stress Test schedule on October 21', '2026-10-15');
    const unrelated = notice('news-other', 'Forever beta patch notes for October 19', '2026-10-15');
    const incoming: CollectedNews = { title: moved.title, url: moved.url, summary: '', sourceLabel: 'Wowhead', publishedAt: moved.publishedAt, official: false, tags: ['news'] };
    const result = ingest(feedWith([sameDate, unrelated]), [incoming], noStats, now);
    expect(result.feed.news.map((n) => n.title)).toEqual([sameDate.title, unrelated.title, moved.title]);
    expect(result.log.filter((l) => l.kind === 'news-removed')).toEqual([]);
  });
});
