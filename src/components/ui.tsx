import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { colors, fonts, radius, spacing } from '../theme';

/** Stone panel framed by a double brass border, like an engraved UI window. */
export function GoldPanel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.frameOuter, style]}>
      <View style={styles.frameInner}>{children}</View>
    </View>
  );
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Chip({
  label,
  active,
  color = colors.gold,
  onPress,
}: {
  label: string;
  active?: boolean;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[styles.chip, { borderColor: active ? color : colors.borderDark }, active && { backgroundColor: colors.stoneLight }]}
    >
      <Text style={[styles.chipText, { color: active ? color : colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function ProgressBar({ value, max, color = colors.frost, label }: { value: number; max: number; color?: string; label?: string }) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }}>
      {label ? <Text style={styles.progressLabel}>{label}</Text> : null}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[styles.buttonText, variant === 'ghost' && { color: colors.gold }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frameOuter: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    padding: 3,
    marginBottom: spacing.md,
  },
  frameInner: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radius.sm,
    backgroundColor: colors.stone,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.heading,
    fontSize: 15,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  muted: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  chip: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginRight: spacing.sm,
    backgroundColor: colors.stoneInset,
  },
  chipText: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  tag: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  tagText: { fontFamily: fonts.heading, fontSize: 10, letterSpacing: 1 },
  progressLabel: { color: colors.parchment, fontFamily: fonts.body, fontSize: 12, marginBottom: 4 },
  progressTrack: {
    height: 12,
    borderWidth: 1,
    borderColor: colors.borderDark,
    backgroundColor: colors.stoneInset,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  button: {
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.borderBright,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonGhost: { backgroundColor: colors.stoneInset },
  buttonText: { color: colors.bg, fontFamily: fonts.heading, letterSpacing: 2, fontSize: 13, fontWeight: '700' },
});
