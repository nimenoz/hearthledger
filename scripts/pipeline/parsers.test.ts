import { describe, expect, it } from 'vitest';

import {
  decodeEntities,
  parseNewsLinks,
  parseRss,
  parseTrackerStats,
  stripTags,
  toIsoDate,
} from './parsers';

const meta = { sourceLabel: 'Test', official: true, tags: ['t'] };

describe('toIsoDate', () => {
  it('returns null for empty or invalid input', () => {
    expect(toIsoDate('')).toBeNull();
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate('not a date')).toBeNull();
  });

  it('formats RFC 822 dates and epoch milliseconds as ISO dates', () => {
    expect(toIsoDate('Sat, 17 Oct 2026 12:00:00 GMT')).toBe('2026-10-17');
    expect(toIsoDate(Date.UTC(2026, 10, 4))).toBe('2026-11-04');
  });
});

describe('decodeEntities and stripTags', () => {
  it('decodes common entities and removes markup', () => {
    expect(decodeEntities('Tom &amp; Jerry &#39;x&#39; &#x41;')).toBe("Tom & Jerry 'x' A");
    expect(stripTags('<p>Hello&nbsp;<b>world</b></p>  again')).toBe('Hello world again');
  });
});

describe('parseRss', () => {
  it('reads items, unwraps CDATA and skips items without a link or title', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title><![CDATA[Forever beta opens]]></title><link>https://example.com/a</link>
        <description>&lt;p&gt;Beta is &lt;b&gt;live&lt;/b&gt;&lt;/p&gt;</description>
        <pubDate>Sat, 17 Oct 2026 12:00:00 GMT</pubDate></item>
      <item><title>No link</title></item>
      <item><link>https://example.com/b</link></item>
    </channel></rss>`;
    const items = parseRss(xml, meta);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      url: 'https://example.com/a',
      title: 'Forever beta opens',
      summary: 'Beta is live',
      publishedAt: '2026-10-17',
      sourceLabel: 'Test',
      official: true,
    });
  });
});

describe('parseNewsLinks', () => {
  it('keeps en-us news links, resolves relative hrefs and de-duplicates', () => {
    const html = `
      <a href="/en-us/news/24301145">WoW Forever launch date announced</a>
      <a href="https://news.blizzard.com/en-us/article/24303313/deep-dive">Deep Dive recap for Forever</a>
      <a href="/en-us/news/24301145">WoW Forever launch date announced</a>
      <a href="/de-de/news/1">Deutsche Nachricht Titel</a>
      <a href="/en-us/news/2">Short</a>`;
    const items = parseNewsLinks(html, 'https://worldofwarcraft.blizzard.com/en-us/news', meta);
    expect(items.map((i) => i.url)).toEqual([
      'https://worldofwarcraft.blizzard.com/en-us/news/24301145',
      'https://news.blizzard.com/en-us/article/24303313/deep-dive',
    ]);
    expect(items[0].title).toBe('WoW Forever launch date announced');
  });
});

describe('parseTrackerStats', () => {
  it('reads the beta headline counts, with thousands separators', () => {
    const text = 'Beta data: 5,594 new items and 4,581 changed from Classic. 759 talent and spell changes.';
    expect(parseTrackerStats(text)).toEqual({ newItems: 5594, changedItems: 4581, spellTalentChanges: 759 });
  });

  it('leaves counts undefined when the text does not contain them', () => {
    expect(parseTrackerStats('nothing here')).toEqual({});
  });
});
