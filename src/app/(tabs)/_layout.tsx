import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';

import { colors, fonts } from '../../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  // React Navigation always passes a string colour for tab icons; anything else falls back to the theme default.
  return <Ionicons name={name} color={typeof color === 'string' ? color : colors.muted} size={size} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.stone },
        headerTintColor: colors.gold,
        headerTitleStyle: { fontFamily: fonts.heading, letterSpacing: 1.5, textTransform: 'uppercase' },
        tabBarStyle: { backgroundColor: colors.stone, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 0.5 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Changes', tabBarIcon: (p) => <TabIcon name="git-compare-outline" {...p} /> }} />
      <Tabs.Screen name="news" options={{ title: 'News', tabBarIcon: (p) => <TabIcon name="newspaper-outline" {...p} /> }} />
      <Tabs.Screen name="armoury" options={{ title: 'Armoury', tabBarIcon: (p) => <TabIcon name="shield-half-outline" {...p} /> }} />
      <Tabs.Screen name="sources" options={{ title: 'Sources', tabBarIcon: (p) => <TabIcon name="library-outline" {...p} /> }} />
    </Tabs>
  );
}
