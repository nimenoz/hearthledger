import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoldPanel, Muted, ProgressBar, SectionTitle, Tag } from '../../../components/ui';
import { useArmoury, useCharacterDetail } from '../../../data/armoury/useArmoury';
import { computeTracker, DEFAULT_LEVEL_CAP, DEFAULT_TARGET_ITEM_LEVEL, loadGoals, saveGoals } from '../../../data/armoury/tracker';
import type { TrackerGoal } from '../../../data/armoury/types';
import { colors, fonts, quality, QualityKey, spacing } from '../../../theme';

const DEFAULT_GOALS: TrackerGoal[] = [
  { id: 'level-cap', label: `Reach level ${DEFAULT_LEVEL_CAP}`, done: false },
  { id: 'gear-target', label: `Reach item level ${DEFAULT_TARGET_ITEM_LEVEL}`, done: false },
  { id: 'profession', label: 'Max out a primary profession', done: false },
  { id: 'first-raid', label: 'Clear your first raid', done: false },
];

export default function CharacterScreen() {
  const { realm, name } = useLocalSearchParams<{ realm: string; name: string }>();
  const realmSlug = String(realm ?? '');
  const characterName = String(name ?? '');
  const { session, ready } = useArmoury();
  const { detail, loading, error } = useCharacterDetail(ready ? session : null, realmSlug, characterName);

  const [goals, setGoals] = useState<TrackerGoal[]>(DEFAULT_GOALS);
  const [goalsLoaded, setGoalsLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    loadGoals(session.region, realmSlug, characterName).then((stored) => {
      if (cancelled) return;
      setGoals(stored.length > 0 ? stored : DEFAULT_GOALS);
      setGoalsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [session, realmSlug, characterName]);

  const progress = useMemo(() => (detail ? computeTracker(detail, goals) : null), [detail, goals]);

  async function toggleGoal(id: string) {
    const next = goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g));
    setGoals(next);
    if (session && goalsLoaded) await saveGoals(session.region, realmSlug, characterName, next);
  }

  if (!ready || loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: characterName }} />
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: characterName }} />
        <Muted>Sign in with Battle.net from the Armoury tab to view this character.</Muted>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: characterName }} />
        <Muted style={{ color: colors.danger }}>{error ?? 'Character not found.'}</Muted>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: detail.name }} />

      <GoldPanel>
        <Text style={styles.name}>{detail.name}</Text>
        <Muted>
          {detail.realmName} · Level {detail.level}
        </Muted>
        <View style={styles.tags}>
          <Tag label={detail.className} color={colors.gold} />
          <Tag label={detail.raceName} color={colors.frost} />
          <Tag label={detail.faction} color={colors.muted} />
          {detail.activeSpec ? <Tag label={detail.activeSpec} color={colors.success} /> : null}
        </View>
        {detail.averageItemLevel !== null ? (
          <Text style={styles.ilvl}>
            Item level <Text style={{ color: colors.gold }}>{Math.round(detail.averageItemLevel)}</Text>
          </Text>
        ) : null}
      </GoldPanel>

      <GoldPanel>
        <SectionTitle>Progress tracker</SectionTitle>
        {progress ? (
          <View style={{ gap: spacing.md }}>
            <ProgressBar label={`Overall · ${Math.round(progress.overallPct * 100)}%`} value={progress.overallPct} max={1} color={colors.gold} />
            <ProgressBar label={`Level ${detail.level} / ${DEFAULT_LEVEL_CAP}`} value={progress.levelPct} max={1} color={colors.frost} />
            <ProgressBar
              label={`Item level ${detail.averageItemLevel ? Math.round(detail.averageItemLevel) : '–'} / ${DEFAULT_TARGET_ITEM_LEVEL}`}
              value={progress.itemLevelPct}
              max={1}
              color={colors.success}
            />
            <ProgressBar label="Profession skill" value={progress.professionPct} max={1} color={quality.EPIC} />
          </View>
        ) : null}
        <SectionTitle style={{ marginTop: spacing.lg }}>Goals</SectionTitle>
        {goals.map((g) => (
          <Pressable key={g.id} accessibilityRole="checkbox" accessibilityState={{ checked: g.done }} onPress={() => toggleGoal(g.id)} style={styles.goal}>
            <Text style={[styles.box, g.done && { color: colors.success }]}>{g.done ? '☑' : '☐'}</Text>
            <Text style={[styles.goalText, g.done && { color: colors.muted, textDecorationLine: 'line-through' }]}>{g.label}</Text>
          </Pressable>
        ))}
      </GoldPanel>

      <GoldPanel>
        <SectionTitle>Professions</SectionTitle>
        {detail.professions.length === 0 ? <Muted>No professions recorded.</Muted> : null}
        {detail.professions.map((p) => (
          <View key={p.name} style={{ marginBottom: spacing.md }}>
            <ProgressBar label={`${p.name} · ${p.skill} / ${p.maxSkill || '–'}`} value={p.skill} max={p.maxSkill || 1} color={colors.gold} />
          </View>
        ))}
      </GoldPanel>

      <GoldPanel>
        <SectionTitle>Equipment</SectionTitle>
        {detail.equipment.length === 0 ? <Muted>No equipment data available.</Muted> : null}
        {detail.equipment.map((item, index) => (
          <View key={`${index}-${item.slot}`} style={styles.item}>
            <Text style={styles.slot}>{item.slot}</Text>
            <Text style={[styles.itemName, { color: qualityColor(item.quality) }]}>{item.name}</Text>
            <Text style={styles.itemLevel}>{item.itemLevel ?? ''}</Text>
          </View>
        ))}
      </GoldPanel>

      <GoldPanel>
        <SectionTitle>Achievements</SectionTitle>
        <Text style={styles.ilvl}>{detail.achievementPoints ?? '–'} points</Text>
      </GoldPanel>

    </ScrollView>
  );
}

function qualityColor(name: string): string {
  const key = name.toUpperCase() as QualityKey;
  return quality[key] ?? colors.parchment;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  name: { color: colors.gold, fontFamily: fonts.heading, fontSize: 22, letterSpacing: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  ilvl: { color: colors.parchment, fontFamily: fonts.body, fontSize: 14, marginTop: spacing.sm },
  goal: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  box: { color: colors.gold, fontSize: 18, width: 28 },
  goalText: { color: colors.parchment, fontFamily: fonts.body, fontSize: 14, flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderDark },
  slot: { color: colors.muted, fontSize: 11, width: 90, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemName: { flex: 1, fontFamily: fonts.body, fontSize: 14 },
  itemLevel: { color: colors.gold, fontFamily: fonts.heading, fontSize: 13, marginLeft: spacing.sm },
});
