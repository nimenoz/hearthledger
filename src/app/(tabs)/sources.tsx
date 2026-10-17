import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ActionButton, GoldPanel, Muted, SectionTitle } from '../../components/ui';
import { useFeed } from '../../data/FeedContext';
import { colors, spacing } from '../../theme';

const SOURCES = [
  { name: 'Blizzard Entertainment', url: 'https://worldofwarcraft.blizzard.com/en-us/news/24302093', use: 'Official announcements and panel recaps. Marked "Confirmed".' },
  { name: 'ForeverChanges', url: 'https://foreverchanges.pro/', use: 'Independent beta tracker: items, spells, talents, patch notes. Marked "Tracker".' },
  { name: 'WoW Travelcraft', url: 'https://wow-travelcraft.com/', use: 'Map, zones, flight points and transport. Marked "Tracker".' },
  { name: 'Wowhead', url: 'https://www.wowhead.com/', use: 'Reference for items, spells and quests. Linked, not scraped by the bundled collector.' },
  { name: 'r/wow (Reddit)', url: 'https://www.reddit.com/r/wow/', use: 'Community discussion. Used as a lead for review, never as a confirmed source.' },
];

export default function SourcesScreen() {
  const { feed, origin, error, refresh, refreshing } = useFeed();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <GoldPanel>
        <SectionTitle>Data status</SectionTitle>
        <Muted>Dataset {feed.updatedAt} (version {feed.version}). Loaded from: {origin === 'remote' ? 'live feed' : origin === 'cache' ? 'cached live feed' : 'bundled data'}.</Muted>
        {error ? <Muted style={{ color: colors.danger }}>Last refresh failed: {error}</Muted> : null}
        <View style={{ marginTop: spacing.md }}>
          <ActionButton label={refreshing ? 'Refreshing…' : 'Refresh now'} disabled={refreshing} onPress={refresh} />
        </View>
      </GoldPanel>

      <GoldPanel>
        <SectionTitle>Sources</SectionTitle>
        {SOURCES.map((s) => (
          <View key={s.name} style={styles.row}>
            <ActionButton label={s.name} variant="ghost" onPress={() => WebBrowser.openBrowserAsync(s.url)} />
            <Muted style={{ marginTop: 4 }}>{s.use}</Muted>
          </View>
        ))}
      </GoldPanel>

      <GoldPanel>
        <SectionTitle>Disclaimer</SectionTitle>
        <Muted>
          Hearthledger is an unofficial fan companion. It is not made, endorsed or sponsored by Blizzard Entertainment. World of Warcraft and related names are trademarks of Blizzard Entertainment, Inc. and are used only to describe the game. Beta information can change before launch.
        </Muted>
      </GoldPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  row: { marginBottom: spacing.md },
});
