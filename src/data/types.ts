// 'confirmed' = stated by Blizzard (official news/panels).
// 'reported'  = from an independent tracker (ForeverChanges, Travelcraft) and based on beta data.
export type ChangeStatus = 'confirmed' | 'reported';

export type ChangeCategory =
  | 'Races'
  | 'Classes'
  | 'Zones'
  | 'Dungeons'
  | 'Raids'
  | 'Professions'
  | 'Items'
  | 'Systems'
  | 'Quests';

export interface ChangeEntry {
  id: string;
  category: ChangeCategory;
  title: string;
  /** What WoW Forever does. */
  forever: string;
  /** What vanilla did, if known. Omitted when not verified. */
  vanilla?: string;
  status: ChangeStatus;
  source: string;
  sourceLabel: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceLabel: string;
  /** ISO date (YYYY-MM-DD) or null when the publication date is not known. */
  publishedAt: string | null;
  official: boolean;
  tags: string[];
}

export interface Feed {
  version: number;
  updatedAt: string;
  changes: ChangeEntry[];
  news: NewsItem[];
}
