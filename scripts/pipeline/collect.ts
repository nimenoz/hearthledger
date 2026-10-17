// Usage: npx tsx scripts/pipeline/collect.ts [--dry-run]
// Writes data/feed.json (only when something changed) and appends to data/changelog.json.
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { seedFeed } from '../../src/data/seed';
import type { Feed } from '../../src/data/types';
import { ingest, type ChangeLogEntry } from './ingest';
import { SOURCES, type FetchText } from './sources';
import type { CollectedNews, TrackerStats } from './parsers';

const USER_AGENT = 'Hearthledger-Collector/1.0 (+https://github.com/hearthledger)';
const MAX_CHANGELOG_RUNS = 100;

export interface RunRecord {
  at: string;
  sourcesOk: string[];
  sourcesFailed: Array<{ name: string; error: string }>;
  log: ChangeLogEntry[];
  changed: boolean;
}

export function isFeedShape(v: unknown): v is Feed {
  if (!v || typeof v !== 'object') return false;
  const f = v as Record<string, unknown>;
  return typeof f.version === 'number' && Array.isArray(f.changes) && Array.isArray(f.news);
}

const fetchText: FetchText = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json,application/rss+xml;q=0.9,*/*;q=0.8' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
};

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

export async function runCollection(opts: {
  dataDir: string;
  dryRun: boolean;
  fetch: FetchText;
  now: Date;
}): Promise<RunRecord> {
  const feedFile = path.join(opts.dataDir, 'feed.json');
  const logFile = path.join(opts.dataDir, 'changelog.json');

  const stored = await readJson<unknown>(feedFile);
  const current: Feed = isFeedShape(stored) ? stored : seedFeed;

  const news: CollectedNews[] = [];
  let stats: TrackerStats = {};
  const sourcesOk: string[] = [];
  const sourcesFailed: RunRecord['sourcesFailed'] = [];

  for (const source of SOURCES) {
    try {
      const result = await source.run(opts.fetch);
      news.push(...result.news);
      stats = { ...stats, ...result.stats };
      sourcesOk.push(source.name);
    } catch (err) {
      sourcesFailed.push({ name: source.name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // If every source failed, keep the existing feed untouched rather than recording an empty run.
  if (sourcesOk.length === 0) {
    throw new Error(`All sources failed: ${sourcesFailed.map((f) => `${f.name} (${f.error})`).join('; ')}`);
  }

  const result = ingest(current, news, stats, opts.now);
  const changed = result.feed !== current;

  const record: RunRecord = {
    at: opts.now.toISOString(),
    sourcesOk,
    sourcesFailed,
    log: result.log,
    changed,
  };

  if (!opts.dryRun) {
    await fs.mkdir(opts.dataDir, { recursive: true });
    // Only persist when something changed, so the scheduled workflow commits real updates only.
    if (changed) {
      await fs.writeFile(feedFile, JSON.stringify(result.feed, null, 2) + '\n');
      const history = (await readJson<RunRecord[]>(logFile)) ?? [];
      history.push(record);
      await fs.writeFile(logFile, JSON.stringify(history.slice(-MAX_CHANGELOG_RUNS), null, 2) + '\n');
    }
  }
  return record;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const record = await runCollection({
    dataDir: path.resolve('data'),
    dryRun,
    fetch: fetchText,
    now: new Date(),
  });
  console.log(`ok: ${record.sourcesOk.join(', ') || 'none'}`);
  for (const f of record.sourcesFailed) console.warn(`failed: ${f.name}: ${f.error}`);
  for (const entry of record.log) console.log(`${entry.kind}: ${entry.detail}`);
  console.log(record.changed ? 'feed updated' : 'no changes');
}

// Run only when executed directly, not when imported by tests.
if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('pipeline', 'collect.ts'))) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
