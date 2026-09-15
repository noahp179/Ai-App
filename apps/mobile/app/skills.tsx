/**
 * The skill map.
 *
 * Four hundred skills with the dependencies between them, which is the
 * clearest single answer to "what is actually in here". Two views:
 *
 *  - **Ready** — the skills whose prerequisites are all mastered and which are
 *    not yet. This is the short, actionable list, and the reason the graph is
 *    worth having rather than merely interesting.
 *  - **Map** — every skill by domain and depth, with mastery shown, so the
 *    shape of the subject and your progress through it are visible at once.
 *
 * Each layer flows as a wrapping row of chips rather than a horizontal rail.
 * A rail hid most of every layer off the right edge, with a clipped card as the
 * only hint that anything was there, and gave a mouse nothing to drag. Letting
 * the chips size to their own names and wrap keeps every skill readable at any
 * width, and packs a 15-skill layer into three lines on a laptop.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  DOMAIN_LABELS,
  prerequisiteChain,
  readySkills,
  skillGraph,
  skillGraphByDomain,
  skillGraphStats,
  tracksForSkill,
  type Domain,
  type GraphNode,
  type Skill,
  type SkillId,
} from '@synapse/core';
import { Badge, Card, ProgressBar, Screen, Text, useTheme, type Theme } from '@synapse/ui';

import { useProgress } from '../src/store/useProgress';

type MapView = 'Ready' | 'Map';

type Router = ReturnType<typeof useRouter>;

function colourFor(theme: Theme, mastery: number): string {
  if (mastery >= 0.8) return theme.colors.success;
  if (mastery >= 0.6) return theme.colors.primary;
  if (mastery > 0) return theme.colors.warning;
  return theme.colors.border;
}

interface ChipProps {
  skill: Skill;
  node: GraphNode | undefined;
  mastery: number;
  open: boolean;
  onToggle: (skillId: SkillId) => void;
  theme: Theme;
  router: Router;
}

/**
 * A skill row that expands to show what it needs and what it unlocks.
 *
 * Declared at module scope rather than inside the screen. A component defined
 * in a render body is a new component type on every render, so React unmounts
 * and remounts the whole subtree — four hundred chips — every time one of them
 * is tapped.
 */
const SkillChip = React.memo(function SkillChip({
  skill,
  node,
  mastery,
  open,
  onToggle,
  theme,
  router,
}: ChipProps): React.JSX.Element {
  const tracks = open ? tracksForSkill(skill.id) : [];
  const chain = open ? prerequisiteChain(skill.id) : [];

  return (
    <Pressable
      onPress={() => onToggle(skill.id)}
      accessibilityRole="button"
      aria-expanded={open}
      accessibilityLabel={`${skill.name}. Mastery ${Math.round(mastery * 100)} percent. ${
        node?.prerequisites.length ?? 0
      } prerequisites, unlocks ${node?.unlocks.length ?? 0}.`}
      style={{
        borderWidth: 1,
        borderColor: open ? theme.colors.primary : theme.colors.border,
        borderLeftWidth: 4,
        borderLeftColor: colourFor(theme, mastery),
        borderRadius: theme.radii.md,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="caption" tone="default" style={{ flex: 1 }}>
          {skill.name}
        </Text>
        {mastery > 0 ? (
          <Text variant="label" tone="tertiary" caps>
            {Math.round(mastery * 100)}%
          </Text>
        ) : null}
      </View>

      {open ? (
        <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <Badge label={`depth ${node?.depth ?? 0}`} tone="neutral" />
            <Badge label={`unlocks ${node?.unlocks.length ?? 0}`} tone="neutral" />
            <Badge label={skill.level} tone="neutral" />
          </View>

          {chain.length > 0 ? (
            <View>
              <Text variant="label" tone="tertiary" caps>
                Needs first
              </Text>
              <Text variant="caption" tone="secondary">
                {chain.map((s) => s.name).join(' → ')}
              </Text>
            </View>
          ) : (
            <Text variant="caption" tone="tertiary">
              Assumes nothing — this is a starting point.
            </Text>
          )}

          {tracks.length > 0 ? (
            <View>
              <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.xs }}>
                Practised in
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                {tracks.slice(0, 4).map((track) => (
                  <Pressable
                    key={track.id}
                    onPress={() => router.push(`/track/${track.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open the ${track.title} track`}
                    style={{
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.xs,
                      borderRadius: theme.radii.pill,
                      backgroundColor: theme.colors.primarySubtle,
                    }}
                  >
                    <Text variant="caption" tone="primary">
                      {track.icon} {track.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});

export default function SkillsScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const progress = useProgress((s) => s.progress);
  const [view, setView] = useState<MapView>('Ready');
  const [openSkill, setOpenSkill] = useState<string | null>(null);

  const mastery = useMemo(
    () =>
      new Map(
        Object.values(progress.skills).map((skill) => [skill.skillId, skill.mastery] as const),
      ),
    [progress.skills],
  );

  const stats = useMemo(() => skillGraphStats(), []);
  const graph = useMemo(() => skillGraph(), []);
  const columns = useMemo(() => skillGraphByDomain(), []);
  const ready = useMemo(() => readySkills(mastery, 0.6, 12), [mastery]);

  const masteredCount = useMemo(
    () => [...mastery.values()].filter((m) => m >= 0.6).length,
    [mastery],
  );

  const toggle = useCallback((skillId: SkillId) => {
    setOpenSkill((current) => (current === skillId ? null : skillId));
  }, []);

  const gap = theme.spacing.sm;

  const chipFor = (node: GraphNode): React.JSX.Element => (
    <SkillChip
      key={node.skill.id}
      skill={node.skill}
      node={node}
      mastery={mastery.get(node.skill.id) ?? 0}
      open={openSkill === node.skill.id}
      onToggle={toggle}
      theme={theme}
      router={router}
    />
  );

  return (
    <Screen scroll>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.xs,
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
        <Text variant="title">Skill map</Text>
      </View>

      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.lg }}>
        {stats.skills} skills · {stats.edges} dependencies · {stats.maxDepth} layers deep
      </Text>

      <Card style={{ marginBottom: theme.spacing.xl }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.sm,
          }}
        >
          <Text variant="label" tone="tertiary" caps>
            Mastered
          </Text>
          <Text variant="bodyStrong" tone="primary">
            {masteredCount} / {stats.skills}
          </Text>
        </View>
        <ProgressBar value={masteredCount / Math.max(1, stats.skills)} />
      </Card>

      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.lg,
        }}
      >
        {(['Ready', 'Map'] as const).map((option) => (
          <Pressable
            key={option}
            onPress={() => setView(option)}
            accessibilityRole="tab"
            aria-selected={view === option}
            accessibilityLabel={`${option} view`}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: theme.spacing.md,
              borderRadius: theme.radii.md,
              backgroundColor:
                view === option ? theme.colors.primarySubtle : theme.colors.surfaceMuted,
              borderWidth: 1,
              borderColor: view === option ? theme.colors.primary : 'transparent',
            }}
          >
            <Text variant="caption" tone={view === option ? 'primary' : 'secondary'}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      {view === 'Ready' ? (
        <View>
          <Text variant="heading" style={{ marginBottom: theme.spacing.xs }}>
            Ready for you now
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.lg }}>
            Every prerequisite mastered, and this one not yet. Shallowest first, then by how much
            each opens up.
          </Text>

          {ready.length === 0 ? (
            <Card>
              <Text variant="body" tone="secondary">
                Nothing is unlocked yet — finish a lesson or two and this list fills in.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {ready.map((skill) => (
                <SkillChip
                  key={skill.id}
                  skill={skill}
                  node={graph.get(skill.id)}
                  mastery={mastery.get(skill.id) ?? 0}
                  open={openSkill === skill.id}
                  onToggle={toggle}
                  theme={theme}
                  router={router}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View>
          <Text variant="heading" style={{ marginBottom: theme.spacing.xs }}>
            The whole map
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.lg }}>
            Grouped by subject, then by how much each skill assumes. Layer 0 assumes nothing.
          </Text>

          {columns.map((column) => (
            <View key={column.domain} style={{ marginBottom: theme.spacing.xxl }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  marginBottom: theme.spacing.md,
                }}
              >
                <Text variant="subheading" style={{ flex: 1 }}>
                  {DOMAIN_LABELS[column.domain as Domain]}
                </Text>
                <Badge label={`${column.total}`} tone="neutral" />
              </View>

              {column.layers.map((layer, depth) =>
                layer.length === 0 ? null : (
                  <View key={depth} style={{ marginBottom: theme.spacing.md }}>
                    <Text
                      variant="label"
                      tone="tertiary"
                      caps
                      style={{ marginBottom: theme.spacing.xs }}
                    >
                      Layer {depth} · {layer.length}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
                      {/* maxWidth keeps the longest skill name from pushing a
                          chip wider than the screen on a phone. */}
                      {layer.map((node) => (
                        <View key={node.skill.id} style={{ maxWidth: '100%' }}>
                          {chipFor(node)}
                        </View>
                      ))}
                    </View>
                  </View>
                ),
              )}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
