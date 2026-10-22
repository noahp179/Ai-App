import { useEffect, useState } from 'react';
import type { AiStreamEvent } from '../../../shared/types';
import { onAppEvent } from '../../lib/api';
import { invalidate } from '../../lib/query';

/** Accumulates streamed text per message until the final version is saved. */
export function useStreams(conversationId: string | null): Record<string, string> {
  const [text, setText] = useState<Record<string, string>>({});
  useEffect(() => {
    setText({});
    return onAppEvent('ai.stream', (e: AiStreamEvent) => {
      if (e.conversationId !== conversationId) return;
      if (e.kind === 'delta' && e.delta) setText((t) => ({ ...t, [e.messageId]: (t[e.messageId] ?? '') + e.delta }));
      else {
        invalidate(`conversations:${e.conversationId}`, 'conversations:list');
        setText((t) => {
          const { [e.messageId]: _gone, ...rest } = t;
          return rest;
        });
      }
    });
  }, [conversationId]);
  return text;
}
