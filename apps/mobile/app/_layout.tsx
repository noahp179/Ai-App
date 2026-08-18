/**
 * Root layout.
 *
 * Hydrates persisted progress before rendering anything, so the first frame
 * shows the learner's real streak rather than zeros that then jump. Also
 * refreshes hearts and the daily meter whenever the app returns to the
 * foreground — both are time-based and would otherwise be stale.
 */

import React, { useEffect } from 'react';
import { AppState, View, type AppStateStatus } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@synapse/ui';

import { useProgress } from '../src/store/useProgress.js';

export default function RootLayout(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppShell(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const hydrate = useProgress((s) => s.hydrate);
  const refresh = useProgress((s) => s.refresh);
  const hydrated = useProgress((s) => s.hydrated);
  const needsOnboarding = useProgress(
    (s) => s.progress.profile.goals.length === 0 && s.progress.totalXp === 0,
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const handler = (state: AppStateStatus): void => {
      if (state === 'active') refresh();
    };
    const subscription = AppState.addEventListener('change', handler);
    return () => subscription.remove();
  }, [refresh]);

  // Send first-time learners through onboarding. Gated on `hydrated` so a
  // returning user never sees a flash of it while storage is still loading.
  useEffect(() => {
    if (!hydrated || !needsOnboarding) return;
    if (segments[0] === 'onboarding') return;
    router.replace('/onboarding');
  }, [hydrated, needsOnboarding, segments, router]);

  if (!hydrated) {
    // Solid background rather than a spinner: hydration is a few milliseconds,
    // and a spinner that flashes for one frame reads as jank.
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="lesson/[id]"
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="placement" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
