/**
 * Renders a teaching screen.
 *
 * Includes a small markdown subset — bold, emphasis, inline code, fenced code
 * blocks and pipe tables — parsed inline rather than pulled from a library.
 * Content is authored by us, the subset is fixed, and a full markdown renderer
 * is a large dependency for a handful of features.
 */

import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import type { ConceptStep } from '@synapse/core';
import { Card, Entrance, Text, useTheme } from '@synapse/ui';

import { Figure } from './Figure';

export function ConceptView({ step }: { step: ConceptStep }): React.JSX.Element {
  const theme = useTheme();
  const paragraphs = useMemo(() => step.body.split('\n\n'), [step.body]);

  return (
    <View>
      <Entrance index={0}>
        <Text variant="title" style={{ marginBottom: theme.spacing.xl }}>
          {step.title}
        </Text>
      </Entrance>

      {step.figure ? (
        <Entrance index={1}>
          <Figure name={step.figure} style={{ marginBottom: theme.spacing.xl }} />
        </Entrance>
      ) : null}

      {/* Paragraphs arrive in reading order rather than all at once, which
          paces a dense explanation and stops a wall of text landing as a wall. */}
      {paragraphs.map((paragraph, index) => (
        <Entrance key={`${step.id}-p-${index}`} index={index + (step.figure ? 2 : 1)}>
          <Block text={paragraph} />
        </Entrance>
      ))}

      {step.keyTerms && step.keyTerms.length > 0 ? (
        <Entrance index={paragraphs.length + 2}>
        <Card
          background={theme.colors.surfaceMuted}
          style={{ marginTop: theme.spacing.xl }}
        >
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
            Key terms
          </Text>
          <View style={{ gap: theme.spacing.md }}>
            {step.keyTerms.map((term) => (
              <View key={term.term}>
                <Text variant="bodyStrong" tone="primary">
                  {term.term}
                </Text>
                <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.xxs }}>
                  {term.definition}
                </Text>
              </View>
            ))}
          </View>
        </Card>
        </Entrance>
      ) : null}
    </View>
  );
}

/**
 * Dispatches a paragraph to the renderer its shape calls for.
 *
 * The three shapes are distinguished by their first line, which is enough
 * because content splits on blank lines — a table and the prose around it are
 * always separate blocks.
 */
function Block({ text }: { text: string }): React.JSX.Element {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) return <CodeBlock text={trimmed} />;
  if (trimmed.startsWith('|')) return <PipeTable text={trimmed} />;
  return <RichParagraph text={text} />;
}

/**
 * A fenced code block. The language tag is parsed and discarded — we do not
 * syntax highlight, and a label above a four-line snippet is noise.
 */
function CodeBlock({ text }: { text: string }): React.JSX.Element {
  const theme = useTheme();
  const lines = text.split('\n');
  const body = lines
    .slice(1, lines[lines.length - 1]?.trim().startsWith('```') ? -1 : undefined)
    .join('\n');

  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.lg,
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text variant="mono" mono tone="default">
          {body}
        </Text>
      </ScrollView>
    </View>
  );
}

/**
 * A pipe table.
 *
 * Phone width is the constraint: columns are laid out with flex so a long cell
 * wraps rather than forcing a horizontal scroll, and the separator row
 * (`|---|---|`) is dropped rather than rendered as a row of dashes.
 */
function PipeTable({ text }: { text: string }): React.JSX.Element {
  const theme = useTheme();

  const rows = useMemo(() => {
    const cells = (line: string): string[] =>
      line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());
    return text
      .split('\n')
      .filter((line) => line.trim().startsWith('|'))
      .filter((line) => !/^\|[\s:|-]+\|?$/.test(line.trim()))
      .map(cells);
  }, [text]);

  const header = rows[0];
  if (!header) return <RichParagraph text={text} />;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radii.md,
        overflow: 'hidden',
        marginBottom: theme.spacing.lg,
      }}
    >
      {rows.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={{
            flexDirection: 'row',
            backgroundColor:
              rowIndex === 0 ? theme.colors.surfaceMuted : theme.colors.surface,
            borderTopWidth: rowIndex === 0 ? 0 : 1,
            borderTopColor: theme.colors.border,
          }}
        >
          {header.map((_, colIndex) => (
            <View
              key={colIndex}
              style={{
                flex: 1,
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                borderLeftWidth: colIndex === 0 ? 0 : 1,
                borderLeftColor: theme.colors.border,
              }}
            >
              <Text
                variant={rowIndex === 0 ? 'label' : 'caption'}
                tone={rowIndex === 0 ? 'tertiary' : 'secondary'}
                caps={rowIndex === 0}
              >
                {(row[colIndex] ?? '').replace(/\*\*/g, '').replace(/`/g, '')}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Parses `**bold**`, `*emphasis*` and `` `code` `` into styled runs.
 *
 * Splitting on the combined pattern keeps the runs in document order, which a
 * pair of sequential replaces would not. Bold is listed first in the
 * alternation so `**x**` is never mistaken for an emphasis run wrapping `*x*`.
 */
function RichParagraph({ text }: { text: string }): React.JSX.Element {
  const theme = useTheme();

  const runs = useMemo(() => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^\s*][^*\n]*[^\s*]\*|\*[^\s*]\*|`[^`]+`)/g).filter(Boolean);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { key: index, text: part.slice(2, -2), kind: 'bold' as const };
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return { key: index, text: part.slice(1, -1), kind: 'emphasis' as const };
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return { key: index, text: part.slice(1, -1), kind: 'code' as const };
      }
      return { key: index, text: part, kind: 'plain' as const };
    });
  }, [text]);

  // A list item — render with a hanging indent rather than as a paragraph.
  const isListItem = /^[-•]\s/.test(text) || /^\d+\.\s/.test(text);

  return (
    <Text
      variant="body"
      tone="secondary"
      style={{
        marginBottom: theme.spacing.lg,
        paddingLeft: isListItem ? theme.spacing.md : 0,
      }}
    >
      {runs.map((run) => {
        if (run.kind === 'bold') {
          return (
            <Text key={run.key} variant="bodyStrong" tone="default">
              {run.text}
            </Text>
          );
        }
        if (run.kind === 'emphasis') {
          return (
            <Text key={run.key} tone="default" style={{ fontStyle: 'italic' }}>
              {run.text}
            </Text>
          );
        }
        if (run.kind === 'code') {
          return (
            <Text
              key={run.key}
              variant="mono"
              mono
              tone="primary"
              style={{ backgroundColor: theme.colors.surfaceMuted }}
            >
              {` ${run.text} `}
            </Text>
          );
        }
        return <Text key={run.key}>{run.text}</Text>;
      })}
    </Text>
  );
}
