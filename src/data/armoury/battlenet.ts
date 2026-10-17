import type { CharacterDetail, CharacterSummary, EquippedItem, Profession, Region } from './types';

export interface RegionConfig {
  label: string;
  apiHost: string;
  locale: string;
}

export const REGIONS: Record<Region, RegionConfig> = {
  us: { label: 'Americas', apiHost: 'us.api.blizzard.com', locale: 'en_US' },
  eu: { label: 'Europe', apiHost: 'eu.api.blizzard.com', locale: 'en_GB' },
  kr: { label: 'Korea', apiHost: 'kr.api.blizzard.com', locale: 'ko_KR' },
  tw: { label: 'Taiwan', apiHost: 'tw.api.blizzard.com', locale: 'zh_TW' },
};

export const AUTHORIZE_URL = 'https://oauth.battle.net/authorize';
/** Grants access to the signed-in user's World of Warcraft characters. */
export const SCOPE = 'wow.profile';

export function buildAuthorizeUrl(params: { clientId: string; redirectUri: string; state: string }): string {
  const query = [
    ['client_id', params.clientId],
    ['redirect_uri', params.redirectUri],
    ['response_type', 'code'],
    ['scope', SCOPE],
    ['state', params.state],
  ]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${AUTHORIZE_URL}?${query}`;
}

export type AuthResult = { ok: true; accessToken: string; expiresIn: number } | { ok: false; error: string };

/**
 * The token-exchange Worker redirects back to the app with the token in the URL fragment
 * (fragments are not sent to servers or written to logs). Validates `state` against what we sent.
 */
export function parseAuthFragment(url: string, expectedState: string): AuthResult {
  const hashIndex = url.indexOf('#');
  if (hashIndex < 0) return { ok: false, error: 'Sign-in returned no data.' };
  const params = new Map<string, string>();
  for (const pair of url.slice(hashIndex + 1).split('&')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    params.set(decodeURIComponent(pair.slice(0, eq)), decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')));
  }
  const error = params.get('error');
  if (error) return { ok: false, error: `Battle.net sign-in failed: ${error}` };
  if (params.get('state') !== expectedState) return { ok: false, error: 'Sign-in state did not match. Try again.' };
  const accessToken = params.get('access_token');
  const expiresIn = Number(params.get('expires_in'));
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return { ok: false, error: 'Sign-in returned an incomplete token.' };
  }
  return { ok: true, accessToken, expiresIn };
}

export class ArmouryApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ArmouryApiError';
  }
}

export function isAuthExpired(err: unknown): boolean {
  return err instanceof ArmouryApiError && (err.status === 401 || err.status === 403);
}

async function getJson(region: Region, path: string, accessToken: string): Promise<unknown> {
  const cfg = REGIONS[region];
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://${cfg.apiHost}${path}${sep}namespace=profile-${region}&locale=${cfg.locale}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  if (!res.ok) throw new ArmouryApiError(`Battle.net returned HTTP ${res.status}`, res.status);
  return res.json();
}

/** Lower-cases the name and encodes it, as the Profile API requires. */
function characterPath(realmSlug: string, name: string): string {
  return `/profile/wow/character/${encodeURIComponent(realmSlug.toLowerCase())}/${encodeURIComponent(name.toLowerCase())}`;
}

export async function fetchCharacterList(region: Region, accessToken: string): Promise<CharacterSummary[]> {
  return parseAccountCharacters(await getJson(region, '/profile/user/wow', accessToken));
}

/** Loads the summary, equipment, professions and achievement points. Optional sections degrade to empty. */
export async function fetchCharacterDetail(
  region: Region,
  accessToken: string,
  character: Pick<CharacterSummary, 'realmSlug' | 'name'>,
): Promise<CharacterDetail> {
  const base = characterPath(character.realmSlug, character.name);
  const summaryJson = await getJson(region, base, accessToken);
  const [equipmentJson, professionsJson, achievementsJson] = await Promise.all([
    optional(() => getJson(region, `${base}/equipment`, accessToken)),
    optional(() => getJson(region, `${base}/professions`, accessToken)),
    optional(() => getJson(region, `${base}/achievements`, accessToken)),
  ]);
  return {
    ...parseCharacterSummary(summaryJson),
    equipment: equipmentJson === null ? [] : parseEquipment(equipmentJson),
    professions: professionsJson === null ? [] : parseProfessions(professionsJson),
    achievementPoints: achievementsJson === null ? null : parseAchievementPoints(achievementsJson),
  };
}

/** Returns null for non-auth failures (e.g. a section a character has never opened); rethrows auth errors. */
async function optional(load: () => Promise<unknown>): Promise<unknown | null> {
  try {
    return await load();
  } catch (err) {
    if (isAuthExpired(err)) throw err;
    return null;
  }
}

// ---- Pure parsers. They accept unknown JSON and tolerate missing fields. ----

type Json = Record<string, unknown>;

function rec(v: unknown): Json {
  return v !== null && typeof v === 'object' ? (v as Json) : {};
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function parseAccountCharacters(json: unknown): CharacterSummary[] {
  const out: CharacterSummary[] = [];
  for (const account of arr(rec(json).wow_accounts)) {
    for (const c of arr(rec(account).characters)) {
      const ch = rec(c);
      const realm = rec(ch.realm);
      out.push({
        name: str(ch.name),
        realmSlug: str(realm.slug),
        realmName: str(realm.name),
        level: num(ch.level) ?? 0,
        className: str(rec(ch.playable_class).name, 'Unknown'),
        raceName: str(rec(ch.playable_race).name, 'Unknown'),
        faction: str(rec(ch.faction).name, 'Unknown'),
      });
    }
  }
  return out.filter((c) => c.name && c.realmSlug);
}

export function parseCharacterSummary(json: unknown): CharacterSummary & Pick<CharacterDetail, 'averageItemLevel' | 'activeSpec'> {
  const ch = rec(json);
  const realm = rec(ch.realm);
  return {
    name: str(ch.name),
    realmSlug: str(realm.slug),
    realmName: str(realm.name),
    level: num(ch.level) ?? 0,
    className: str(rec(ch.character_class).name, 'Unknown'),
    raceName: str(rec(ch.race).name, 'Unknown'),
    faction: str(rec(ch.faction).name, 'Unknown'),
    averageItemLevel: num(ch.average_item_level),
    activeSpec: rec(ch.active_spec).name ? str(rec(ch.active_spec).name) : null,
  };
}

export function parseEquipment(json: unknown): EquippedItem[] {
  return arr(rec(json).equipped_items).map((raw) => {
    const item = rec(raw);
    return {
      slot: str(rec(item.slot).name, 'Slot'),
      name: str(item.name, 'Unknown item'),
      quality: str(rec(item.quality).name, 'Common'),
      itemLevel: num(rec(item.level).value),
    };
  });
}

export function parseProfessions(json: unknown): Profession[] {
  const root = rec(json);
  const all = [...arr(root.primaries), ...arr(root.secondaries)];
  return all.map((raw) => {
    const p = rec(raw);
    const tier = rec(arr(p.tiers)[0]);
    return {
      name: str(rec(p.profession).name, 'Profession'),
      skill: num(tier.skill_points) ?? 0,
      maxSkill: num(tier.max_skill_points) ?? 0,
    };
  });
}

export function parseAchievementPoints(json: unknown): number | null {
  return num(rec(json).total_points);
}
