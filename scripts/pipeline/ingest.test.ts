import { describe, expect, it } from 'vitest';

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
