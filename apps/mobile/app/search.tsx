/**
 * Search.
 *
 * Forty tracks and two hundred lessons is past the point where browsing finds
 * anything. This screen exists so that "where was the bit about deadlock" is a
 * five-second question rather than a five-minute one.
 *
 * Results route straight to the thing found — a lesson result opens the
 * lesson itself, not the track it sits in. Skills are the exception: a skill
 * is not a screen, so tapping one routes to the first track that practises it,
 * which is what someone searching a term actually wants.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  SEARCH_SUGGESTIONS,
  searchCatalog,
  tracksForSkill,
  type SearchResult,
} from '@synapse/core';
import { Badge, Card, Screen, Text, useTheme } from '@synapse/ui';

const KIND_LABEL: Record<SearchResult['kind'], string> = {
  track: 'Track',
  path: 'Path',
  lesson: 'Lesson',
  skill: 'Skill',
};

export default function SearchScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchCatalog(query), [query]);
  const trimmed = query.trim();

  /**
   * Skills have no screen of their own, so route to the first track that
   * practises the skill — which is what someone searching a term wants.
   */
  const open = (result: SearchResult): void => {
    switch (result.kind) {
      case 'track':
        router.push(`/track/${result.id}`);
        return;
      case 'path':
        router.push(`/path/${result.id}`);
        return;
      case 'lesson':
        // Straight into the lesson. The player re-checks entitlement and
        // bounces to the paywall itself, so arriving from search cannot skip a
        // lock.
        router.push(`/lesson/${result.id}`);
        return;
      case 'skill': {
        const tracks = tracksForSkill(result.id);
        const first = tracks[0];
        router.push(first ? `/track/${first.id}` : '/learn');
        return;
      }
      default:
        return;
    }
  };

  return (
    <Screen scroll>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.lg,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
        >
          <Text variant="body" tone="primary">
            ←
          </Text>
        </Pressable>
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Search tracks, lessons and skills"
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel="Search the catalog"
          returnKeyType="search"
          style={{
            flex: 1,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surfaceMuted,
            color: theme.colors.text,
            ...theme.typography.body,
          }}
        />
        {trimmed.length > 0 ? (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear the search"
            hitSlop={12}
          >
            <Text variant="body" tone="tertiary">
              ✕
            </Text>
          </Pressable>
        ) : null}
      </View>

      {trimmed.length < 2 ? (
        <View>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
            Try one of these
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {SEARCH_SUGGESTIONS.map((suggestion) => (
              <Pressable
                key={suggestion}
                onPress={() => setQuery(suggestion)}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${suggestion}`}
                style={{
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radii.pill,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Text variant="caption" tone="secondary">
                  {suggestion}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : results.length === 0 ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityLabel={`No results for ${trimmed}`}
          style={{ paddingVertical: theme.spacing.xxxl, alignItems: 'center' }}
        >
          <Text variant="heading" tone="tertiary">
            Nothing found
          </Text>
          <Text
            variant="caption"
            tone="tertiary"
            style={{ marginTop: theme.spacing.sm, textAlign: 'center' }}
          >
            Try a single word — searches match every term, so a long phrase finds less.
          </Text>
        </View>
      ) : (
        <View accessibilityLiveRegion="polite" accessibilityLabel={`${results.length} results`}>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
            {results.length} result{results.length === 1 ? '' : 's'}
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            {results.map((result) => (
              <Pressable
                key={`${result.kind}-${result.id}`}
                onPress={() => open(result)}
                accessibilityRole="button"
                accessibilityLabel={`${KIND_LABEL[result.kind]}: ${result.title}. ${result.subtitle}`}
              >
                <Card>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      marginBottom: theme.spacing.xs,
                    }}
                  >
                    <Badge
                      label={KIND_LABEL[result.kind]}
                      tone={result.kind === 'track' || result.kind === 'path' ? 'primary' : 'neutral'}
                    />
                    <Text variant="bodyStrong" style={{ flex: 1 }}>
                      {result.title}
                    </Text>
                  </View>
                  <Text variant="caption" tone="secondary">
                    {result.subtitle}
                  </Text>
                  {result.snippet ? (
                    <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.xs }}>
                      {result.snippet}
                    </Text>
                  ) : null}
                </Card>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}
