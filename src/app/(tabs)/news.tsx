import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { GoldPanel, Muted, Tag } from '../../components/ui';
import { useFeed } from '../../data/FeedContext';
import type { NewsItem } from '../../data/types';
import { colors, fonts, spacing } from '../../theme';

export default function NewsScreen() {
  const { feed, refresh, refreshing } = useFeed();

  return (
    <FlatList
      style={styles.screen}
      data={feed.news}
      keyExtractor={(n) => n.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.heading}>Forever News</Text>
          <Muted>Blizzard announcements and independent tracker updates. Official items are marked.</Muted>
        </View>
      }
      renderItem={({ item }) => <NewsCard item={item} />}
    />
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(item.url)}>
      <GoldPanel>
        <View style={styles.tags}>
          <Tag label={item.official ? 'Official' : 'Tracker'} color={item.official ? colors.success : colors.frost} />
          {item.tags.slice(0, 2).map((t) => (
            <Tag key={t} label={t} color={colors.muted} />
          ))}
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.summary}</Text>
        <Muted>
          {item.sourceLabel}
          {item.publishedAt ? ` · ${item.publishedAt}` : ''}
        </Muted>
      </GoldPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg },
  header: { marginBottom: spacing.md, gap: spacing.xs },
  heading: { color: colors.gold, fontFamily: fonts.heading, fontSize: 22, letterSpacing: 1.5, textTransform: 'uppercase' },
  tags: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' },
  title: { color: colors.parchment, fontFamily: fonts.heading, fontSize: 16, marginBottom: 4 },
  body: { color: colors.parchment, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm },
});
