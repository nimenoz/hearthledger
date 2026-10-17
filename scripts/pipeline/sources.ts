import {
  parseNewsLinks,
  parseRss,
  parseTrackerStats,
  stripTags,
  type CollectedNews,
  type TrackerStats,
} from './parsers';

export type FetchText = (url: string) => Promise<string>;

export interface SourceResult {
  news: CollectedNews[];
  stats: TrackerStats;
}

export interface CollectorSource {
  name: string;
  /** Used only for logging. Each source fetches and parses its own URL. */
  url: string;
  run: (fetchText: FetchText) => Promise<SourceResult>;
}

const FOREVER_RE = /forever/i;
/**
 * Sources. Official news comes from Blizzard; community and tracker sources are marked non-official
 * so the app labels them clearly. Tracker stats are 'reported' beta data, never 'confirmed'.
 */
export const SOURCES: CollectorSource[] = [
  {
    name: 'blizzard-news',
    url: 'https://worldofwarcraft.blizzard.com/en-us/news',
    async run(fetchText) {
      const html = await fetchText(this.url);
      const news = parseNewsLinks(html, this.url, {
        sourceLabel: 'Blizzard',
        official: true,
        tags: ['official'],
      }).filter((n) => FOREVER_RE.test(n.title));
      return { news, stats: {} };
    },
  },
  {
    name: 'wowhead-news',
    url: 'https://www.wowhead.com/news/rss/all',
    async run(fetchText) {
      const xml = await fetchText(this.url);
      const news = parseRss(xml, {
        sourceLabel: 'Wowhead',
        official: false,
        tags: ['news'],
      }).filter((n) => FOREVER_RE.test(n.title));
      return { news, stats: {} };
    },
  },
  {
    name: 'foreverchanges',
    url: 'https://foreverchanges.pro/',
    async run(fetchText) {
      const html = await fetchText(this.url);
      return { news: [], stats: parseTrackerStats(stripTags(html)) };
    },
  },
];
