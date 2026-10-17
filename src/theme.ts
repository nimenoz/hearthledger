import { Platform } from 'react-native';

// Original palette inspired by dark-stone fantasy UI: obsidian stone, brass borders,
// parchment text. Blizzard logos/art are NOT used anywhere in this app.
export const colors = {
  bg: '#0a0907',
  stone: '#1b1712',
  stoneLight: '#2a241c',
  stoneInset: '#120f0b',
  border: '#8a6a2b',
  borderBright: '#f0c24b',
  borderDark: '#3d2f14',
  gold: '#f0c24b',
  parchment: '#eadcb8',
  muted: '#9c8f74',
  frost: '#6fc3ff',
  danger: '#e0574a',
  success: '#7fd35a',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

// Item quality colours (the standard common/uncommon/rare/epic/legendary scale).
export const quality = {
  POOR: '#9d9d9d',
  COMMON: '#ffffff',
  UNCOMMON: '#1eff00',
  RARE: '#0070dd',
  EPIC: '#a335ee',
  LEGENDARY: '#ff8000',
  ARTIFACT: '#e6cc80',
  HEIRLOOM: '#00ccff',
} as const;

export type QualityKey = keyof typeof quality;

export const categoryColor: Record<string, string> = {
  Races: '#c77dff',
  Classes: '#ff9f43',
  Zones: '#7fd35a',
  Dungeons: '#6fc3ff',
  Raids: '#ff6b6b',
  Professions: '#f9ca24',
  Items: '#ffd32a',
  Systems: '#9ad0ec',
  Quests: '#e6cc80',
};

export const fonts = {
  // Serif headings with wide tracking give the engraved-plaque look without shipping a font file.
  heading: Platform.select({ ios: 'Georgia-Bold', android: 'serif', default: 'serif' }) as string,
  body: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) as string,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radius = { sm: 3, md: 5 } as const;
