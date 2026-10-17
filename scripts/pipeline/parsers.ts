// Pure parsers. No network access here, so every function is unit-testable.

export interface CollectedNews {
  url: string;
  title: string;
  summary: string;
  /** ISO date (YYYY-MM-DD) or null. */
  publishedAt: string | null;
  sourceLabel: string;
  official: boolean;
  tags: string[];
}

export interface TrackerStats {
  newItems?: number;
  changedItems?: number;
  spellTalentChanges?: number;
}

export interface NewsSourceMeta {
  sourceLabel: string;
  official: boolean;
  tags: string[];
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function toIsoDate(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined || input === '') return null;
  const d = typeof input === 'number' ? new Date(input) : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function readTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  return decodeEntities(m[1].trim().replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')).trim();
}

/** Parses RSS 2.0 <item> elements. */
export function parseRss(xml: string, meta: NewsSourceMeta): CollectedNews[] {
  const blocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  const out: CollectedNews[] = [];
  for (const block of blocks) {
    const url = readTag(block, 'link');
    const title = stripTags(readTag(block, 'title'));
    if (!/^https?:\/\//.test(url) || !title) continue;
    out.push({
      url,
      title,
      summary: stripTags(readTag(block, 'description')).slice(0, 280),
      publishedAt: toIsoDate(readTag(block, 'pubDate')),
      ...meta,
    });
  }
  return out;
}

/**
 * Extracts Blizzard news article links from an HTML index page.
 * Only links under /en-us/news/ or /en-us/article/ are considered.
 */
export function parseNewsLinks(html: string, baseUrl: string, meta: NewsSourceMeta): CollectedNews[] {
  const re = /<a\b[^>]*href="([^"#]*\/en-us\/(?:news|article)\/[^"#]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const out: CollectedNews[] = [];
  for (const m of html.matchAll(re)) {
    let url: string;
    try {
      url = new URL(decodeEntities(m[1]), baseUrl).toString();
    } catch {
      continue;
    }
    const title = stripTags(m[2]);
    if (title.length < 8 || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title, summary: '', publishedAt: null, ...meta });
  }
  return out;
}

const toNumber = (s: string): number => parseInt(s.replace(/,/g, ''), 10);

/** Reads the headline counts from the ForeverChanges beta page text. Missing counts are left undefined. */
export function parseTrackerStats(text: string): TrackerStats {
  const flat = text.replace(/\s+/g, ' ');
  const stats: TrackerStats = {};
  const items = flat.match(/([\d,]+)\s+new items and\s+([\d,]+)\s+changed/i);
  if (items) {
    stats.newItems = toNumber(items[1]);
    stats.changedItems = toNumber(items[2]);
  }
  const spells = flat.match(/([\d,]+)\s+talent and spell changes/i);
  if (spells) stats.spellTalentChanges = toNumber(spells[1]);
  return stats;
}
