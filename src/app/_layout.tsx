import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { FeedProvider } from '../data/FeedContext';
import { colors, fonts } from '../theme';

export default function RootLayout() {
  return (
    <FeedProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.stone },
          headerTintColor: colors.gold,
          headerTitleStyle: { fontFamily: fonts.heading },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="change/[id]" options={{ title: 'Change' }} />
      </Stack>
    </FeedProvider>
  );
}
