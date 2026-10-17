import {
  parseNewsLinks,
  parseRedditAtom,
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
/** Post titles that describe a change, not a question, meme or guild ad. A heuristic, so review the feed. */
const REDDIT_CHANGE_RE = /\b(beta|patch|hotfix|updates?|announc\w*|launch\w*|release|changes?|build|talents?|dungeons?|races?|classes?|respec)\b/i;
/** Questions, memes, recruitment and merch posts that match the change words but are not news. */
const REDDIT_NOISE_RE =
  /\?|\b(guild|recruit\w*|lfg|lfm|merch\w*|collector'?s|edition|giveaway|meme|rant|anyone|help|how|why|what|who|when|which)\b/i;
const REDDIT_MAX_POSTS = 10;

export function isRelevantRedditPost(title: string): boolean {
  return FOREVER_RE.test(title) && REDDIT_CHANGE_RE.test(title) && !REDDIT_NOISE_RE.test(title);
}

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
    name: 'reddit-r-wow',
    url: 'https://www.reddit.com/r/wow/search.rss?q=forever&restrict_sr=1&sort=new&limit=50',
    async run(fetchText) {
      const xml = await fetchText(this.url);
      const news = parseRedditAtom(xml, {
        sourceLabel: 'r/wow',
        official: false,
        tags: ['community'],
      })
        .filter((n) => isRelevantRedditPost(n.title))
        .slice(0, REDDIT_MAX_POSTS);
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
