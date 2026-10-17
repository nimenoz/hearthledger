import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined },
}));

import { buildAuthorizeUrl, parseAuthFragment } from './battlenet';
import { computeTracker, DEFAULT_LEVEL_CAP, DEFAULT_TARGET_ITEM_LEVEL } from './tracker';
import type { CharacterDetail, TrackerGoal } from './types';

describe('parseAuthFragment', () => {
  const back = 'hearthledger://armoury';

  it('accepts a token whose state matches', () => {
    const url = `${back}#access_token=abc123&expires_in=86399&state=s1`;
    expect(parseAuthFragment(url, 's1')).toEqual({ ok: true, accessToken: 'abc123', expiresIn: 86399 });
  });

  it('rejects a state mismatch', () => {
    const url = `${back}#access_token=abc123&expires_in=86399&state=other`;
    expect(parseAuthFragment(url, 's1')).toMatchObject({ ok: false });
  });

  it('shows the provider error before checking state', () => {
    const result = parseAuthFragment(`${back}#error=access_denied&state=other`, 's1');
    expect(result).toEqual({ ok: false, error: 'Battle.net sign-in failed: access_denied' });
  });

  it('rejects a missing fragment, missing token and non-positive expiry', () => {
    expect(parseAuthFragment(back, 's1').ok).toBe(false);
    expect(parseAuthFragment(`${back}#expires_in=10&state=s1`, 's1').ok).toBe(false);
    expect(parseAuthFragment(`${back}#access_token=x&expires_in=0&state=s1`, 's1').ok).toBe(false);
  });
});

describe('buildAuthorizeUrl', () => {
  it('includes client, redirect, state and the wow.profile scope', () => {
    const url = new URL(buildAuthorizeUrl({ clientId: 'cid', redirectUri: 'https://x.test/cb', state: 'st' }));
    expect(url.origin + url.pathname).toBe('https://oauth.battle.net/authorize');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('redirect_uri')).toBe('https://x.test/cb');
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('scope')).toBe('wow.profile');
    expect(url.searchParams.get('response_type')).toBe('code');
  });
});

const detail = (over: Partial<CharacterDetail> = {}): CharacterDetail => ({
  name: 'Test',
  realmSlug: 'realm',
  realmName: 'Realm',
  level: 30,
  className: 'Warrior',
  raceName: 'Human',
  faction: 'Alliance',
  averageItemLevel: 100,
  activeSpec: null,
  achievementPoints: null,
  equipment: [],
  professions: [
    { name: 'Mining', skill: 150, maxSkill: 300 },
    { name: 'Smithing', skill: 300, maxSkill: 300 },
  ],
  ...over,
});

describe('computeTracker', () => {
  it('uses the default caps and averages the dimensions', () => {
    const goals: TrackerGoal[] = [
      { id: 'a', label: 'A', done: true },
      { id: 'b', label: 'B', done: false },
    ];
    const p = computeTracker(detail(), goals);
    expect(p.levelPct).toBeCloseTo(30 / DEFAULT_LEVEL_CAP);
    expect(p.itemLevelPct).toBeCloseTo(100 / DEFAULT_TARGET_ITEM_LEVEL);
    expect(p.professionPct).toBeCloseTo(450 / 600);
    expect(p.goalsDone).toBe(1);
    expect(p.goalsTotal).toBe(2);
    expect(p.overallPct).toBeCloseTo((0.5 + 0.5 + 0.75 + 0.5) / 4);
  });

  it('leaves goals out of the average when there are none, and clamps values', () => {
    const p = computeTracker(detail({ level: 999, averageItemLevel: null, professions: [] }), []);
    expect(p.levelPct).toBe(1);
    expect(p.itemLevelPct).toBe(0);
    expect(p.professionPct).toBe(0);
    expect(p.overallPct).toBeCloseTo((1 + 0 + 0) / 3);
  });
});
