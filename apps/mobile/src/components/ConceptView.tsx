/**
 * Renders a teaching screen.
 *
 * Includes a small markdown subset — bold, inline code, and paragraphs — parsed
 * inline rather than pulled from a library. Content is authored by us, the
 * subset is fixed, and a full markdown renderer is a large dependency for three
 * features.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import type { ConceptStep } from '@synapse/core';
import { Card, Text, useTheme } from '@synapse/ui';

import { Figure } from './Figure';

export function ConceptView({ step }: { step: ConceptStep }): React.JSX.Element {
  const theme = useTheme();
  const paragraphs = useMemo(() => step.body.split('\n\n'), [step.body]);

  return (
    <View>
      <Text variant="title" style={{ marginBottom: theme.spacing.xl }}>
        {step.title}
      </Text>

      {step.figure ? (
        <Figure name={step.figure} style={{ marginBottom: theme.spacing.xl }} />
      ) : null}

      {paragraphs.map((paragraph, index) => (
        <RichParagraph key={`${step.id}-p-${index}`} text={paragraph} />
      ))}

      {step.keyTerms && step.keyTerms.length > 0 ? (
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
      ) : null}
    </View>
  );
}

/**
 * Parses `**bold**` and `` `code` `` into styled runs.
 *
 * Splitting on the combined pattern keeps the runs in document order, which a
 * pair of sequential replaces would not.
 */
function RichParagraph({ text }: { text: string }): React.JSX.Element {
  const theme = useTheme();

  const runs = useMemo(() => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { key: index, text: part.slice(2, -2), kind: 'bold' as const };
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
