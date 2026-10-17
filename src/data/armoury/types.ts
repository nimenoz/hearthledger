export type Region = 'us' | 'eu' | 'kr' | 'tw';

export interface Session {
  accessToken: string;
  /** Epoch milliseconds after which the token must not be used. */
  expiresAt: number;
  region: Region;
}

export interface CharacterSummary {
  name: string;
  realmSlug: string;
  realmName: string;
  level: number;
  className: string;
  raceName: string;
  faction: string;
}

export interface CharacterDetail extends CharacterSummary {
  averageItemLevel: number | null;
  activeSpec: string | null;
  achievementPoints: number | null;
  equipment: EquippedItem[];
  professions: Profession[];
}

export interface EquippedItem {
  slot: string;
  name: string;
  quality: string;
  itemLevel: number | null;
}

export interface Profession {
  name: string;
  skill: number;
  maxSkill: number;
}

export interface TrackerGoal {
  id: string;
  label: string;
  done: boolean;
}
