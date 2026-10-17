import { Link, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip, GoldPanel, Muted, Tag } from '../../components/ui';
import { useFeed } from '../../data/FeedContext';
import type { ChangeCategory, ChangeEntry } from '../../data/types';
import { categoryColor, colors, fonts, spacing } from '../../theme';

type Filter = 'All' | 'Saved' | ChangeCategory;

const FILTERS: Filter[] = ['All', 'Saved', 'Races', 'Classes', 'Zones', 'Dungeons', 'Professions', 'Items', 'Systems', 'Quests'];

export default function ChangesScreen() {
  const { feed, refresh, refreshing, origin, error, saved, toggleSaved, seen, markSeen } = useFeed();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');

  const changes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feed.changes.filter(
      (c) =>
        (filter === 'All' || (filter === 'Saved' ? saved.has(c.id) : c.category === filter)) &&
        (q === '' || c.title.toLowerCase().includes(q) || c.forever.toLowerCase().includes(q)),
    );
  }, [feed.changes, query, filter, saved]);

  const newCount = useMemo(() => feed.changes.filter((c) => !seen.has(c.id)).length, [feed.changes, seen]);

  // Changes count as seen once the user leaves this tab, so the NEW badges stay visible while reading.
  const allIds = useMemo(() => feed.changes.map((c) => c.id), [feed.changes]);
  useFocusEffect(
    useCallback(() => {
      return () => markSeen(allIds);
    }, [allIds, markSeen]),
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.heading}>Vanilla → Forever</Text>
        <Muted>
          {feed.changes.length} tracked changes{newCount > 0 ? ` · ${newCount} new` : ''} · data {feed.updatedAt} · {origin === 'remote' ? 'live feed' : 'bundled'}
        </Muted>
        {error ? <Muted style={{ color: colors.danger }}>Feed update failed: {error}</Muted> : null}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search changes"
          placeholderTextColor={colors.muted}
          style={styles.search}
          accessibilityLabel="Search changes"
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(c) => c}
          style={styles.chips}
          renderItem={({ item }) => (
            <Chip
              label={item}
              active={filter === item}
              color={item === 'All' || item === 'Saved' ? colors.gold : categoryColor[item] ?? colors.gold}
              onPress={() => setFilter(item)}
            />
          )}
        />
      </View>

      <FlatList
        data={changes}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />}
        ListEmptyComponent={<Muted>{filter === 'Saved' ? 'No saved changes yet. Tap the star on a change to save it.' : 'No changes match that filter.'}</Muted>}
        renderItem={({ item }) => (
          <ChangeCard change={item} isNew={!seen.has(item.id)} isSaved={saved.has(item.id)} onToggleSaved={() => toggleSaved(item.id)} />
        )}
      />
    </View>
  );
}

function ChangeCard({
  change,
  isNew,
  isSaved,
  onToggleSaved,
}: {
  change: ChangeEntry;
  isNew: boolean;
  isSaved: boolean;
  onToggleSaved: () => void;
}) {
  const color = categoryColor[change.category] ?? colors.gold;
  return (
    <Link href={{ pathname: '/change/[id]', params: { id: change.id } }} asChild>
      <Pressable accessibilityRole="link">
        <GoldPanel>
          <View style={styles.cardTop}>
            <Tag label={change.category} color={color} />
            <Tag label={change.status === 'confirmed' ? 'Blizzard' : 'Tracker'} color={change.status === 'confirmed' ? colors.success : colors.frost} />
            {isNew ? <Tag label="New" color={colors.gold} /> : null}
            <Pressable
              onPress={onToggleSaved}
              hitSlop={12}
              style={styles.saveButton}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? 'Remove from saved' : 'Save change'}
              accessibilityState={{ selected: isSaved }}
            >
              <Text style={[styles.saveIcon, isSaved && { color: colors.gold }]}>{isSaved ? '★' : '☆'}</Text>
            </Pressable>
          </View>
          <Text style={styles.cardTitle}>{change.title}</Text>
          <Text style={styles.cardBody} numberOfLines={2}>
            {change.forever}
          </Text>
        </GoldPanel>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  heading: { color: colors.gold, fontFamily: fonts.heading, fontSize: 22, letterSpacing: 1.5, textTransform: 'uppercase' },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    backgroundColor: colors.stoneInset,
    color: colors.parchment,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
  },
  chips: { flexGrow: 0, marginVertical: spacing.sm },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  cardTop: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'center' },
  saveButton: { marginLeft: 'auto' },
  saveIcon: { color: colors.muted, fontSize: 18 },
  cardTitle: { color: colors.parchment, fontFamily: fonts.heading, fontSize: 16, marginBottom: 4 },
  cardBody: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
});
