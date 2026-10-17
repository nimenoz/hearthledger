import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCollection } from './collect';
import type { FetchText } from './sources';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'collect-test-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const blizzardHtml = `<a href="/en-us/news/24400001">Forever launch update for players</a>`;
const redditAtom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry>
  <link href="https://www.reddit.com/r/wow/comments/x1/beta/" />
  <published>2026-10-17T03:39:38+00:00</published><title>Forever beta patch 1.60 notes</title></entry></feed>`;
const wowheadRss = `<?xml version="1.0"?><rss><channel><item><title>Forever stress test moved</title><link>https://www.wowhead.com/news/forever-stress-test-1</link><pubDate>Fri, 16 Oct 2026 21:18:50 -0500</pubDate></item></channel></rss>`;
const trackerHtml = '<p>5,594 new items and 4,581 changed</p><p>759 talent and spell changes</p>';

const fakeFetch: FetchText = async (url) => {
  if (url.includes('blizzard')) return blizzardHtml;
  if (url.includes('wowhead')) return wowheadRss;
  if (url.includes('reddit')) return redditAtom;
  if (url.includes('foreverchanges')) return trackerHtml;
  throw new Error(`unexpected url ${url}`);
};

describe('runCollection', () => {
  it('writes the feed and a changelog entry when new items arrive', async () => {
    const record = await runCollection({ dataDir: dir, dryRun: false, fetch: fakeFetch, now: new Date('2026-10-18T06:00:00Z') });
    expect(record.changed).toBe(true);
    expect(record.sourcesOk).toEqual(['blizzard-news', 'wowhead-news', 'reddit-r-wow', 'foreverchanges']);
    expect(record.sourcesFailed).toEqual([]);

    const feed = JSON.parse(await fs.readFile(path.join(dir, 'feed.json'), 'utf8'));
    expect(feed.news.some((n: { url: string }) => n.url.endsWith('/24400001'))).toBe(true);
    expect(feed.news.some((n: { url: string }) => n.url.includes('reddit.com'))).toBe(true);
    expect(feed.news.some((n: { url: string }) => n.url.includes('wowhead.com'))).toBe(true);

    const log = JSON.parse(await fs.readFile(path.join(dir, 'changelog.json'), 'utf8'));
    expect(log).toHaveLength(1);
  });

  it('does not rewrite the feed on a second identical run', async () => {
    const now = new Date('2026-10-18T06:00:00Z');
    await runCollection({ dataDir: dir, dryRun: false, fetch: fakeFetch, now });
    const first = await fs.readFile(path.join(dir, 'feed.json'), 'utf8');
    const second = await runCollection({ dataDir: dir, dryRun: false, fetch: fakeFetch, now });
    expect(second.changed).toBe(false);
    expect(await fs.readFile(path.join(dir, 'feed.json'), 'utf8')).toBe(first);
  });

  it('leaves the changelog alone when nothing changed', async () => {
    const now = new Date('2026-10-18T06:00:00Z');
    await runCollection({ dataDir: dir, dryRun: false, fetch: fakeFetch, now });
    await runCollection({ dataDir: dir, dryRun: false, fetch: fakeFetch, now });
    const log = JSON.parse(await fs.readFile(path.join(dir, 'changelog.json'), 'utf8'));
    expect(log).toHaveLength(1);
  });

  it('isolates a failing source and still ingests the rest', async () => {
    const partial: FetchText = async (url) => {
      if (url.includes('reddit')) throw new Error('HTTP 429');
      return fakeFetch(url);
    };
    const record = await runCollection({ dataDir: dir, dryRun: false, fetch: partial, now: new Date() });
    expect(record.sourcesFailed).toEqual([{ name: 'reddit-r-wow', error: 'HTTP 429' }]);
    expect(record.sourcesOk).toContain('blizzard-news');
    expect(record.changed).toBe(true);
  });

  it('throws and writes nothing when every source fails', async () => {
    const down: FetchText = async () => {
      throw new Error('offline');
    };
    await expect(runCollection({ dataDir: dir, dryRun: false, fetch: down, now: new Date() })).rejects.toThrow(
      'All sources failed',
    );
    await expect(fs.access(path.join(dir, 'feed.json'))).rejects.toThrow();
  });

  it('dry run reports changes without writing files', async () => {
    const record = await runCollection({ dataDir: dir, dryRun: true, fetch: fakeFetch, now: new Date() });
    expect(record.changed).toBe(true);
    await expect(fs.access(path.join(dir, 'feed.json'))).rejects.toThrow();
  });
});
