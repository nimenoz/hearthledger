import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { REGIONS } from '../../data/armoury/battlenet';
import type { CharacterSummary, Region } from '../../data/armoury/types';
import { useArmoury } from '../../data/armoury/useArmoury';
import { ActionButton, Chip, GoldPanel, Muted, SectionTitle, Tag } from '../../components/ui';
import { colors, fonts, spacing } from '../../theme';

const REGION_KEYS = Object.keys(REGIONS) as Region[];
const CONFIGURED = !!process.env.EXPO_PUBLIC_BATTLENET_CLIENT_ID && !!process.env.EXPO_PUBLIC_ARMOURY_CALLBACK_URL;

export default function ArmouryScreen() {
  const { session, characters, ready, loading, error, signIn, signOut, loadCharacters } = useArmoury();
  const [region, setRegion] = useState<Region>('us');

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.screen}>
        <GoldPanel>
          <SectionTitle>Armoury</SectionTitle>
          <Muted>
            Sign in with your Battle.net account to see your World of Warcraft characters: class, level, gear, professions and a progress tracker.
          </Muted>
          <Muted style={{ marginTop: spacing.sm }}>Characters appear once the game is live. Forever launches November 4, 2026.</Muted>
        </GoldPanel>

        <GoldPanel>
          <SectionTitle>Region</SectionTitle>
          <View style={styles.chips}>
            {REGION_KEYS.map((r) => (
              <Chip key={r} label={`${r.toUpperCase()} · ${REGIONS[r].label}`} active={region === r} onPress={() => setRegion(r)} />
            ))}
          </View>
          <View style={{ marginTop: spacing.md }}>
            <ActionButton
              label={loading ? 'Opening Battle.net…' : 'Sign in with Battle.net'}
              disabled={loading || !CONFIGURED}
              onPress={() => signIn(region)}
            />
          </View>
          {!CONFIGURED ? <Muted style={styles.error}>Armoury is not configured for this build.</Muted> : null}
          {error ? <Muted style={styles.error}>{error}</Muted> : null}
        </GoldPanel>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={characters}
      keyExtractor={(c) => `${c.realmSlug}-${c.name}`}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <GoldPanel>
          <SectionTitle>Your characters</SectionTitle>
          <Muted>Region {session.region.toUpperCase()} · Tap a character for its armoury.</Muted>
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <ActionButton label={loading ? 'Loading…' : 'Load characters'} disabled={loading} onPress={loadCharacters} />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton label="Sign out" variant="ghost" onPress={signOut} />
            </View>
          </View>
          {error ? <Muted style={styles.error}>{error}</Muted> : null}
          {!loading && characters.length === 0 && !error ? (
            <Muted style={{ marginTop: spacing.sm }}>No characters loaded yet. Tap "Load characters".</Muted>
          ) : null}
        </GoldPanel>
      }
      renderItem={({ item }) => <CharacterRow character={item} />}
    />
  );
}

function CharacterRow({ character }: { character: CharacterSummary }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/character/[realm]/[name]', params: { realm: character.realmSlug, name: character.name } })
      }
    >
      <GoldPanel>
        <Text style={styles.charName}>{character.name}</Text>
        <Muted>
          {character.realmName} · Level {character.level}
        </Muted>
        <View style={styles.tags}>
          <Tag label={character.className} color={colors.gold} />
          <Tag label={character.raceName} color={colors.frost} />
          <Tag label={character.faction} color={colors.muted} />
        </View>
      </GoldPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  error: { color: colors.danger, marginTop: spacing.sm },
  charName: { color: colors.gold, fontFamily: fonts.heading, fontSize: 17, marginBottom: 2 },
  tags: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
});
