import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CharacterDetail, TrackerGoal } from './types';

/** Level cap used for progress. Adjust if the launch cap differs. */
export const DEFAULT_LEVEL_CAP = 60;
/** Gear target used for the item-level bar. */
export const DEFAULT_TARGET_ITEM_LEVEL = 200;

export interface TrackerSettings {
  levelCap: number;
  targetItemLevel: number;
}

export interface TrackerProgress {
  level: number;
  levelPct: number;
  itemLevelPct: number;
  professionPct: number;
  goalsDone: number;
  goalsTotal: number;
  overallPct: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Fraction-based progress for each tracked dimension, averaged into an overall figure. */
export function computeTracker(
  detail: Pick<CharacterDetail, 'level' | 'averageItemLevel' | 'professions'>,
  goals: TrackerGoal[],
  settings: TrackerSettings = { levelCap: DEFAULT_LEVEL_CAP, targetItemLevel: DEFAULT_TARGET_ITEM_LEVEL },
): TrackerProgress {
  const levelPct = settings.levelCap > 0 ? clamp01(detail.level / settings.levelCap) : 0;
  const itemLevelPct =
    detail.averageItemLevel !== null && settings.targetItemLevel > 0
      ? clamp01(detail.averageItemLevel / settings.targetItemLevel)
      : 0;

  const skill = detail.professions.reduce((sum, p) => sum + p.skill, 0);
  const maxSkill = detail.professions.reduce((sum, p) => sum + p.maxSkill, 0);
  const professionPct = maxSkill > 0 ? clamp01(skill / maxSkill) : 0;

  const goalsDone = goals.filter((g) => g.done).length;
  const goalsTotal = goals.length;
  const goalsPct = goalsTotal > 0 ? goalsDone / goalsTotal : null;

  const parts = [levelPct, itemLevelPct, professionPct, ...(goalsPct === null ? [] : [goalsPct])];
  const overallPct = parts.reduce((a, b) => a + b, 0) / parts.length;

  return {
    level: detail.level,
    levelPct,
    itemLevelPct,
    professionPct,
    goalsDone,
    goalsTotal,
    overallPct,
  };
}

const goalsKey = (region: string, realmSlug: string, name: string) =>
  `hearthledger/goals/${region}/${realmSlug.toLowerCase()}/${name.toLowerCase()}`;

export async function loadGoals(region: string, realmSlug: string, name: string): Promise<TrackerGoal[]> {
  try {
    const raw = await AsyncStorage.getItem(goalsKey(region, realmSlug, name));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isGoal) : [];
  } catch {
    return [];
  }
}

export async function saveGoals(region: string, realmSlug: string, name: string, goals: TrackerGoal[]): Promise<void> {
  await AsyncStorage.setItem(goalsKey(region, realmSlug, name), JSON.stringify(goals));
}

function isGoal(v: unknown): v is TrackerGoal {
  if (!v || typeof v !== 'object') return false;
  const g = v as Record<string, unknown>;
  return typeof g.id === 'string' && typeof g.label === 'string' && typeof g.done === 'boolean';
}
