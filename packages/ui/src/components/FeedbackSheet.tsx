/**
 * The panel that slides up after an answer.
 *
 * This is where the actual teaching lands, so it gets the explanation at full
 * body size rather than as fine print. It slides from the bottom and owns the
 * continue button, meaning the learner's thumb does not travel between reading
 * the explanation and moving on.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ScrollView,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

export interface FeedbackSheetProps {
  visible: boolean;
  correct: boolean;
  /** The teaching text. Always shown, right or wrong. */
  explanation: string;
  /** Short headline — "Correct!", "Not quite". */
  title?: string;
  continueLabel?: string;
  onContinue: () => void;
  /** Optional slot for the "Ask the tutor" affordance. */
  actions?: React.ReactNode;
  bottomInset?: number;
  /**
   * Reports the sheet's measured height. The lesson player pads its scroll area
   * by exactly this, so the option the learner just answered clears the sheet
   * without leaving a guessed-at gap of dead space.
   */
  onHeightChange?: (height: number) => void;
  style?: StyleProp<ViewStyle>;
}

export function FeedbackSheet({
  visible,
  correct,
  explanation,
  title,
  continueLabel,
  onContinue,
  actions,
  bottomInset = 0,
  onHeightChange,
  style,
}: FeedbackSheetProps): React.JSX.Element | null {
  const theme = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const slide = useRef(new Animated.Value(visible ? 1 : 0)).current;

  // Cap the sheet so a long explanation can never grow tall enough to bury the
  // question it is explaining. Past the cap the text scrolls inside the sheet
  // and the continue button stays pinned where the thumb expects it.
  const maxHeight = Math.round(screenHeight * 0.62);

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [visible, slide]);

  if (!visible) return null;

  const accent = correct ? theme.colors.success : theme.colors.danger;
  const tint = correct ? theme.colors.successSubtle : theme.colors.dangerSubtle;
  const headline = title ?? (correct ? 'Correct' : 'Not quite');

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tint,
          borderTopLeftRadius: theme.radii.xxl,
          borderTopRightRadius: theme.radii.xxl,
          borderTopWidth: 2,
          borderColor: accent,
          maxHeight,
          paddingHorizontal: theme.layout.screenPadding,
          paddingTop: theme.spacing.xl,
          paddingBottom: theme.spacing.xl + bottomInset,
          transform: [
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) },
          ],
        },
        theme.elevation.lg,
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
        <Text variant="heading" style={{ color: accent }}>
          {correct ? '✓' : '✕'}  {headline}
        </Text>
      </View>

      <ScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={{ paddingBottom: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="body" tone="secondary" style={{ marginBottom: theme.spacing.lg }}>
          {explanation}
        </Text>

        {actions ? <View style={{ marginBottom: theme.spacing.lg }}>{actions}</View> : null}
      </ScrollView>

      <Button
        label={continueLabel ?? 'Continue'}
        variant={correct ? 'success' : 'danger'}
        size="lg"
        fullWidth
        onPress={onContinue}
      />
    </Animated.View>
  );
}
