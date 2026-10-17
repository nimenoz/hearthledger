import { useLocalSearchParams, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { ActionButton, GoldPanel, Muted, SectionTitle, Tag } from '../../components/ui';
import { useFeed } from '../../data/FeedContext';
import { categoryColor, colors, fonts, spacing } from '../../theme';

export default function ChangeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, saved, toggleSaved } = useFeed();
  const change = feed.changes.find((c) => c.id === id);

  if (!change) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Muted>This change is not in the current feed.</Muted>
      </View>
    );
  }

  const color = categoryColor[change.category] ?? colors.gold;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: change.category }} />
      <View style={styles.tags}>
        <Tag label={change.category} color={color} />
        <Tag label={change.status === 'confirmed' ? 'Confirmed by Blizzard' : 'Reported by tracker'} color={change.status === 'confirmed' ? colors.success : colors.frost} />
      </View>
      <Text style={styles.title}>{change.title}</Text>

      <GoldPanel>
        <SectionTitle>Vanilla</SectionTitle>
        <Text style={styles.body}>{change.vanilla ?? 'Not verified yet. Check the source for the vanilla comparison.'}</Text>
      </GoldPanel>

      <GoldPanel>
        <SectionTitle>WoW Forever</SectionTitle>
        <Text style={styles.body}>{change.forever}</Text>
      </GoldPanel>

      <Muted>Source: {change.sourceLabel}</Muted>
      <ActionButton
        label={saved.has(change.id) ? 'Remove from saved' : 'Save change'}
        variant="ghost"
        onPress={() => toggleSaved(change.id)}
      />
      <ActionButton
        label="Share"
        variant="ghost"
        onPress={() => void Share.share({ message: `${change.title}\n\n${change.forever}\n\nSource: ${change.source}` })}
      />
      <ActionButton label="Open source" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(change.source)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.sm },
  tags: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  title: { color: colors.parchment, fontFamily: fonts.heading, fontSize: 24, marginBottom: spacing.sm },
  body: { color: colors.parchment, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
});
