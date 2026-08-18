/**
 * Screen wrapper.
 *
 * Applies safe-area insets, the background colour, and a max content width so
 * the same screens work on a phone and on a Mac window without a second layout.
 */

import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';

export interface ScreenProps {
  children: React.ReactNode;
  /** Wraps content in a ScrollView. Off for screens that manage their own list. */
  scroll?: boolean;
  /** Horizontal screen padding. Off for edge-to-edge lists. */
  padded?: boolean;
  /** Constrains content to a readable measure and centres it on wide windows. */
  centered?: boolean;
  maxWidth?: number;
  /** Extra bottom padding, e.g. to clear a fixed footer button. */
  footerSpace?: number;
  background?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  centered = false,
  maxWidth,
  footerSpace = 0,
  background,
  style,
  testID,
}: ScreenProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const contentWidth = maxWidth ?? (centered ? theme.layout.maxReadingWidth : theme.layout.maxContentWidth);

  const inner = (
    <View
      style={[
        {
          flex: scroll ? undefined : 1,
          width: '100%',
          maxWidth: contentWidth,
          alignSelf: 'center',
          paddingHorizontal: padded ? theme.layout.screenPadding : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: insets.top + theme.spacing.sm,
        paddingBottom: insets.bottom + theme.spacing.xxl + footerSpace,
        flexGrow: 1,
      }}
    >
      {inner}
    </ScrollView>
  ) : (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + theme.spacing.sm,
        paddingBottom: insets.bottom + footerSpace,
      }}
    >
      {inner}
    </View>
  );

  return (
    <View
      testID={testID}
      style={{ flex: 1, backgroundColor: background ?? theme.colors.background }}
    >
      <StatusBar barStyle={theme.scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </View>
  );
}
