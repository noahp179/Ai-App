/**
 * Paywall.
 *
 * Two rules shape this screen.
 *
 * First, the trigger changes the headline. Someone who hit a heart wall and
 * someone who tapped "upgrade" in settings need different first sentences, and
 * a generic pitch converts worse than a specific one on both.
 *
 * Second, the dismiss control is real and immediately visible. A paywall you
 * cannot leave produces a refund and a one-star review, not a subscriber.
 */

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CONSUMABLES,
  PLANS,
  annualSavingsPercent,
  formatPrice,
  monthlyEquivalent,
  type PaywallTrigger,
  type PlanId,
} from '@synapse/core';
import { Badge, Button, Card, Screen, Text, useTheme } from '@synapse/ui';

import { useProgress } from '../src/store/useProgress.js';

const HEADLINES: Record<PaywallTrigger, { title: string; body: string }> = {
  'locked-lesson': {
    title: 'Keep going',
    body: 'This lesson is part of the full curriculum. Plus unlocks every track at every level.',
  },
  'hearts-depleted': {
    title: 'Never get stopped again',
    body: 'Plus removes hearts entirely. Make as many mistakes as it takes — that is how learning works.',
  },
  'tutor-limit': {
    title: 'Ask as much as you want',
    body: 'You have used today’s free tutor questions. Plus makes them unlimited.',
  },
  'offline-download': {
    title: 'Learn without a connection',
    body: 'Download the whole catalog and keep your streak on a plane or a commute.',
  },
  certificate: {
    title: 'Prove what you have learned',
    body: 'Pro adds verified certificates with a public credential page you can share.',
  },
  'interview-prep': {
    title: 'Prepare for the interview',
    body: 'Pro includes 500+ real AI and ML interview questions with worked answers.',
  },
  settings: {
    title: 'Go further with Synapse',
    body: 'Every track, unlimited hearts, and a tutor that explains anything you get stuck on.',
  },
  onboarding: {
    title: 'Start with everything unlocked',
    body: 'Try Plus free for 7 days. Cancel any time — we will remind you before it renews.',
  },
  'streak-repair': {
    title: 'Save your streak',
    body: 'Plus includes three streak freezes and a monthly repair, so one bad day does not undo months.',
  },
  'trial-expired': {
    title: 'Your trial has ended',
    body: 'Keep unlimited access to every track, the AI tutor, and offline downloads.',
  },
};

export default function PaywallScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ trigger?: string; plan?: string }>();
  const setEntitlement = useProgress((s) => s.setEntitlement);

  const trigger = (params.trigger as PaywallTrigger) ?? 'settings';
  const headline = HEADLINES[trigger] ?? HEADLINES.settings;

  const [selectedPlan, setSelectedPlan] = useState<PlanId>((params.plan as PlanId) ?? 'plus');
  const [period, setPeriod] = useState<'monthly' | 'annual'>('annual');

  const plan = PLANS[selectedPlan];
  const savings = annualSavingsPercent(plan);
  const perMonth = monthlyEquivalent(plan);

  /**
   * In production this hands off to RevenueCat / StoreKit and the entitlement
   * comes back from a verified receipt. The local write here is what the
   * success callback does — never the source of truth.
   */
  const purchase = (): void => {
    setEntitlement({
      plan: selectedPlan,
      expiresAt: Date.now() + (period === 'annual' ? 365 : 30) * 86_400_000,
      inTrial: plan.trialDays > 0,
      ownedTrackIds: [],
    });
    router.back();
  };

  return (
    <Screen scroll>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={16}
        style={{ alignSelf: 'flex-end', marginBottom: theme.spacing.lg }}
      >
        <Text variant="heading" tone="tertiary">
          ✕
        </Text>
      </Pressable>

      <Text variant="display" style={{ marginBottom: theme.spacing.md }}>
        ✦
      </Text>
      <Text variant="title">{headline.title}</Text>
      <Text variant="body" tone="secondary" style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.xxl }}>
        {headline.body}
      </Text>

      {/* Plan switch */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
        {(['plus', 'pro'] as const).map((id) => (
          <Pressable
            key={id}
            onPress={() => setSelectedPlan(id)}
            style={{
              flex: 1,
              padding: theme.spacing.md,
              borderRadius: theme.radii.lg,
              borderWidth: 2,
              borderColor: selectedPlan === id ? theme.colors.primary : theme.colors.border,
              backgroundColor: selectedPlan === id ? theme.colors.primarySubtle : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text variant="bodyStrong" tone={selectedPlan === id ? 'primary' : 'secondary'}>
              {PLANS[id].name.replace('Synapse ', '')}
            </Text>
            <Text variant="label" tone="tertiary" caps>
              {PLANS[id].tagline}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Billing period */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
        <PeriodOption
          label="Annual"
          price={plan.priceUsd.annual !== undefined ? formatPrice(plan.priceUsd.annual) : '—'}
          detail={perMonth !== null ? `${formatPrice(perMonth)} / month` : undefined}
          badge={savings !== null ? `Save ${savings}%` : undefined}
          active={period === 'annual'}
          onPress={() => setPeriod('annual')}
        />
        <PeriodOption
          label="Monthly"
          price={plan.priceUsd.monthly !== undefined ? formatPrice(plan.priceUsd.monthly) : '—'}
          detail="billed monthly"
          active={period === 'monthly'}
          onPress={() => setPeriod('monthly')}
        />
      </View>

      {/* What you get */}
      <Card outlined style={{ marginBottom: theme.spacing.xl }}>
        <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
          Included
        </Text>
        <View style={{ gap: theme.spacing.md }}>
          {plan.highlights.map((highlight) => (
            <View key={highlight} style={{ flexDirection: 'row' }}>
              <Text variant="body" tone="success" style={{ marginRight: theme.spacing.md }}>
                ✓
              </Text>
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                {highlight}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Button
        label={plan.trialDays > 0 ? `Start ${plan.trialDays}-day free trial` : 'Subscribe'}
        variant="premium"
        size="lg"
        fullWidth
        onPress={purchase}
      />

      <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: theme.spacing.md }}>
        {plan.trialDays > 0
          ? `Free for ${plan.trialDays} days, then ${
              period === 'annual'
                ? `${formatPrice(plan.priceUsd.annual ?? 0)} a year`
                : `${formatPrice(plan.priceUsd.monthly ?? 0)} a month`
            }. Cancel any time in Settings.`
          : 'Cancel any time in Settings.'}
      </Text>

      {/* The honest alternative. Naming it costs a few conversions and buys
          considerably more trust than hiding it does. */}
      <Card outlined style={{ marginTop: theme.spacing.xxl }}>
        <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.sm }}>
          Not ready to subscribe?
        </Text>
        <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
          The AI Foundations track and the first unit of every other track stay free forever. You can
          also buy a single track outright.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {CONSUMABLES.filter((c) => c.kind === 'track' || c.kind === 'certificate').map((item) => (
            <Badge key={item.id} label={`${item.name} · ${formatPrice(item.priceUsd)}`} tone="neutral" />
          ))}
        </View>
      </Card>

      <Pressable
        onPress={() => router.back()}
        style={{ marginTop: theme.spacing.xl, alignItems: 'center' }}
        accessibilityRole="button"
      >
        <Text variant="caption" tone="tertiary">
          Keep using the free plan
        </Text>
      </Pressable>
    </Screen>
  );
}

function PeriodOption({
  label,
  price,
  detail,
  badge,
  active,
  onPress,
}: {
  label: string;
  price: string;
  detail?: string;
  badge?: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        padding: theme.spacing.lg,
        borderRadius: theme.radii.lg,
        borderWidth: 2,
        borderColor: active ? theme.colors.primary : theme.colors.border,
        backgroundColor: active ? theme.colors.primarySubtle : 'transparent',
      }}
    >
      {badge ? <Badge label={badge} tone="success" filled style={{ marginBottom: theme.spacing.sm }} /> : null}
      <Text variant="label" tone="tertiary" caps>
        {label}
      </Text>
      <Text variant="heading" style={{ marginTop: theme.spacing.xxs }}>
        {price}
      </Text>
      {detail ? (
        <Text variant="label" tone="tertiary">
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}
