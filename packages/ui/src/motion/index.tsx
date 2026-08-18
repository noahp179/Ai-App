/**
 * Motion primitives.
 *
 * Animation in a learning app is not decoration — it is feedback. The moment
 * after an answer is when the learner finds out whether they understood, and a
 * static state change wastes it. So the rules here are:
 *
 *  - **Motion carries meaning.** A pop means correct, a shake means wrong, a
 *    count-up means something accumulated. Nothing moves just to look busy.
 *  - **Fast.** Nothing on the critical path exceeds ~350ms. A learner answering
 *    thirty questions must never wait on an animation.
 *  - **Reduced motion is honoured everywhere.** Vestibular disorders are common,
 *    and an education app that makes some users nauseous has failed them. When
 *    the OS setting is on, movement is replaced by an instant state change —
 *    never by nothing, since the feedback still has to land.
 *
 * Everything uses the native driver where the property allows it, so animation
 * runs on the UI thread and does not stutter while React re-renders.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

// ---------------------------------------------------------------------------
// Reduced motion
// ---------------------------------------------------------------------------

const ReducedMotionContext = createContext(false);

/**
 * Tracks the OS "reduce motion" setting and republishes it to the tree.
 *
 * Read once at mount and then kept live via the change listener, because the
 * user can toggle it from Control Center without backgrounding the app.
 */
export function MotionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {
        // Unsupported on some platforms (notably web) — motion stays on.
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return <ReducedMotionContext.Provider value={reduced}>{children}</ReducedMotionContext.Provider>;
}

export function useReducedMotion(): boolean {
  return useContext(ReducedMotionContext);
}

/** Scales a duration to 0 when reduced motion is on, so state still changes. */
export function useDuration(): (ms: number) => number {
  const reduced = useReducedMotion();
  return useCallback((ms: number) => (reduced ? 0 : ms), [reduced]);
}

// ---------------------------------------------------------------------------
// Entrance
// ---------------------------------------------------------------------------

export interface EntranceOptions {
  /** Stagger position. Each index delays by ~45ms, capped so long lists stay snappy. */
  index?: number;
  /** Pixels to travel. Negative slides down from above. */
  distance?: number;
  duration?: number;
  /** Set false to hold before animating — used when content loads late. */
  enabled?: boolean;
}

/**
 * Fade-and-rise on mount.
 *
 * The default for anything appearing on screen. The small upward travel reads
 * as content settling into place rather than popping into existence, which
 * makes a dense screen much easier to parse in sequence.
 */
export function useEntrance({
  index = 0,
  distance = 14,
  duration = 320,
  enabled = true,
}: EntranceOptions = {}): { opacity: Animated.Value; transform: [{ translateY: Animated.Value }] } {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced || !enabled ? 1 : 0)).current;

  useEffect(() => {
    if (!enabled) return;
    if (reduced) {
      progress.setValue(1);
      return;
    }
    // Cap the stagger so the twentieth card is not a second behind the first.
    const delay = Math.min(index * 45, 360);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, index, duration, reduced, enabled]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [distance, 0],
  });

  return { opacity: progress, transform: [{ translateY: translateY as unknown as Animated.Value }] };
}

/** Wraps `useEntrance` for the common case of a plain animated container. */
export function Entrance({
  children,
  style,
  ...options
}: EntranceOptions & { children: ReactNode; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const entrance = useEntrance(options);
  return <Animated.View style={[entrance, style]}>{children}</Animated.View>;
}

/** Staggers its children in sequence. Used for lists of cards and paragraphs. */
export function Stagger({
  children,
  distance,
  style,
}: {
  children: ReactNode;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const items = React.Children.toArray(children);
  return (
    <View style={style}>
      {items.map((child, index) => (
        <Entrance key={index} index={index} distance={distance}>
          {child}
        </Entrance>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

/**
 * A quick scale pop. The "yes, that was right" gesture.
 *
 * Overshoots slightly before settling, which is what makes it read as delight
 * rather than as a resize.
 */
export function usePop(): { style: { transform: [{ scale: Animated.Value }] }; pop: () => void } {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const pop = useCallback(() => {
    if (reduced) return;
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.06,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 9,
        stiffness: 260,
        mass: 0.6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, reduced]);

  return { style: { transform: [{ scale }] }, pop };
}

/**
 * A short horizontal shake. The "not quite" gesture.
 *
 * Deliberately small (6px) and brief — a violent shake reads as an error state
 * in the app rather than as feedback on the answer, and this is a normal,
 * expected part of learning.
 */
export function useShake(): {
  style: { transform: [{ translateX: Animated.Value }] };
  shake: () => void;
} {
  const reduced = useReducedMotion();
  const offset = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    if (reduced) return;
    offset.setValue(0);
    Animated.sequence(
      [-6, 6, -4, 4, 0].map((to) =>
        Animated.timing(offset, {
          toValue: to,
          duration: 55,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [offset, reduced]);

  return { style: { transform: [{ translateX: offset }] }, shake };
}

/**
 * A slow breathing pulse, for drawing the eye to something waiting on input.
 * Runs until unmounted; used sparingly.
 */
export function usePulse(active = true): { transform: [{ scale: Animated.Value }] } {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active || reduced) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.04,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, active, reduced]);

  return { transform: [{ scale }] };
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * A number that counts up to its value.
 *
 * XP and streaks are the reward for finishing something, and watching a number
 * climb is meaningfully more satisfying than seeing it already arrived. Uses a
 * listener rather than the native driver because text content cannot be
 * animated on the UI thread.
 */
export function useCountUp(
  value: number,
  { duration = 900, enabled = true }: { duration?: number; enabled?: boolean } = {},
): number {
  const reduced = useReducedMotion();
  const animated = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(reduced || !enabled ? value : 0);

  useEffect(() => {
    if (reduced || !enabled) {
      setDisplay(value);
      return;
    }
    animated.setValue(0);
    const id = animated.addListener(({ value: t }) => {
      setDisplay(Math.round(t * value));
    });
    const animation = Animated.timing(animated, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(() => setDisplay(value));

    return () => {
      animation.stop();
      animated.removeListener(id);
    };
  }, [value, duration, animated, reduced, enabled]);

  return display;
}

// ---------------------------------------------------------------------------
// Celebration
// ---------------------------------------------------------------------------

/**
 * A radial particle burst.
 *
 * Fires on a correct answer and on milestones. Twelve particles on fixed radial
 * headings — enough to read as celebration, few enough to stay cheap on a
 * mid-range phone, and deterministic so it looks the same every time rather
 * than occasionally landing badly.
 */
export function Burst({
  trigger,
  colors,
  particleCount = 12,
  radius = 90,
  size = 8,
}: {
  /** Increment to fire. A changed value re-runs the animation. */
  trigger: number;
  colors?: string[];
  particleCount?: number;
  radius?: number;
  size?: number;
}): React.JSX.Element | null {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  const palette = colors ?? [
    theme.colors.success,
    theme.colors.primary,
    theme.colors.warning,
    theme.colors.info,
  ];

  const particles = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, i) => {
        const angle = (i / particleCount) * Math.PI * 2;
        // Alternate the reach so the burst has depth rather than one flat ring.
        const reach = radius * (i % 2 === 0 ? 1 : 0.68);
        return {
          dx: Math.cos(angle) * reach,
          dy: Math.sin(angle) * reach,
          color: palette[i % palette.length]!,
        };
      }),
    [particleCount, radius, palette],
  );

  useEffect(() => {
    if (trigger === 0 || reduced) return;
    setVisible(true);
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(() => setVisible(false));
    return () => animation.stop();
  }, [trigger, progress, reduced]);

  if (!visible || reduced) return null;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%' }}>
      {particles.map((particle, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: particle.color,
            opacity: progress.interpolate({
              inputRange: [0, 0.15, 1],
              outputRange: [0, 1, 0],
            }),
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, particle.dx],
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, particle.dy],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0.4, 1, 0.3],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/**
 * Cross-fades between steps in a session.
 *
 * Keyed on `stepKey`: when it changes, the old content fades out and the new
 * one fades in and slides slightly, which makes "I have moved to a new
 * question" unambiguous. Without it, a multiple-choice question following
 * another multiple-choice question can look like nothing happened.
 */
export function StepTransition({
  stepKey,
  children,
  style,
}: {
  stepKey: string | number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  const previousKey = useRef(stepKey);

  useEffect(() => {
    if (previousKey.current === stepKey) return;
    previousKey.current = stepKey;

    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [stepKey, progress, reduced]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Smoothly follows a changing numeric value.
 *
 * The building block for animated charts: widgets pass a target and read back
 * an `Animated.Value` that eases toward it, so a k-means centroid glides to its
 * new position instead of teleporting.
 */
export function useAnimatedValue(
  target: number,
  { duration = 400, easing = Easing.inOut(Easing.cubic) }: { duration?: number; easing?: (v: number) => number } = {},
): Animated.Value {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(target)).current;

  useEffect(() => {
    if (reduced) {
      value.setValue(target);
      return;
    }
    const animation = Animated.timing(value, {
      toValue: target,
      duration,
      easing,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [target, duration, easing, value, reduced]);

  return value;
}

/**
 * Drives a repeating tick while `running` is true.
 *
 * Used by the self-playing widgets — the neural-net trainer, the diffusion
 * denoiser, the Q-learning agent. Deliberately interval-based rather than
 * frame-based: these run real computation per tick, and a 60fps loop of
 * gradient descent would melt a phone battery for no visible benefit.
 */
export function useTicker(
  running: boolean,
  intervalMs: number,
  onTick: () => void,
): void {
  const callback = useRef(onTick);
  callback.current = onTick;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => callback.current(), intervalMs);
    return () => clearInterval(id);
  }, [running, intervalMs]);
}
