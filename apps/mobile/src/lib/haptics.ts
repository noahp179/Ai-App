/**
 * Haptics.
 *
 * Wrapped because haptics are unavailable on web and silently absent on some
 * Android devices, and because a single place to disable them is what makes the
 * accessibility setting a one-line change.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tap — selecting an answer option. */
export function tapFeedback(): void {
  if (!enabled || !supported) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Success notification — a correct answer. */
export function successFeedback(): void {
  if (!enabled || !supported) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Error notification — a wrong answer. */
export function errorFeedback(): void {
  if (!enabled || !supported) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/** Heavier impact — level up, achievement unlocked. */
export function celebrationFeedback(): void {
  if (!enabled || !supported) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}
