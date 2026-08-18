/**
 * Tab bar.
 *
 * Five destinations, which is the ceiling before a tab bar becomes a menu.
 * Emoji icons keep the bundle free of an icon-font dependency and read well at
 * tab size on every platform.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { Text, useTheme } from '@synapse/ui';

export default function TabsLayout(): React.JSX.Element {
  const theme = useTheme();

  const icon = (glyph: string) =>
    function TabIcon({ focused }: { focused: boolean }): React.JSX.Element {
      return <Text variant="subheading" style={{ opacity: focused ? 1 : 0.45 }}>{glyph}</Text>;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: theme.layout.tabBarHeight,
          paddingTop: theme.spacing.sm,
        },
        tabBarLabelStyle: { ...theme.typography.label, textTransform: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('📚') }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice', tabBarIcon: icon('🔁') }} />
      <Tabs.Screen name="playground" options={{ title: 'Lab', tabBarIcon: icon('🧪') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
