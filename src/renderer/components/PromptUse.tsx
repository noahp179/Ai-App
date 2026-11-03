import { ClipboardCopy, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CopyContext } from '../../shared/api';
import { fillVariables, parseVariables } from '../../shared/prompts';
import { useCopy } from '../lib/copy';
import { navigate } from '../lib/router';
import { useSettings } from '../lib/settings';
import { Badge, Button, Field, Input, Textarea, useToast } from './ui';

/** "time available" → "Time available": how a {{variable}} is labelled wherever a prompt is filled in. */
export const variableLabel = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/** The {{variables}} in a prompt, as chips: required ones highlighted, defaults shown. Same in the library, the marketplace and chat. */
export function PromptVariables({ body }: { body: string }) {
  const vars = useMemo(() => parseVariables(body), [body]);
  if (!vars.length) return null;
  return (
    <div className="row-wrap small" style={{ gap: 4 }}>
      <span className="muted">Variables:</span>
      {vars.map((v) => (
        <Badge key={v.name} tone={v.required ? 'accent' : 'outline'}>
          {variableLabel(v.name)}
          {v.defaultValue !== null ? ` = ${v.defaultValue}` : ''}
        </Badge>
      ))}
    </div>
  );
}

/**
 * Fill in a prompt's {{variables}}, then open it in the AI workspace or copy it. With `onAttach` (the chat composer),
 * the filled-in prompt is handed back instead.
 */
export function PromptUse({
  body,
  context,
  onUse,
  onAttach,
}: {
  body: string;
  context: CopyContext;
  onUse?: (how: 'insert' | 'copy') => Promise<string | void> | void;
  onAttach?: (text: string) => void;
}) {
  const { settings } = useSettings();
  const toast = useToast();
  const copy = useCopy();
  const vars = useMemo(() => parseVariables(body), [body]);
  const [values, setValues] = useState<Record<string, string>>({});
  const filled = fillVariables(body, values);
  const go = async (how: 'insert' | 'copy') => {
    if (filled.missing.length) {
      toast(`Fill in: ${filled.missing.map(variableLabel).join(', ')}`, 'error');
      return;
    }
    const fresh = (await onUse?.(how)) ?? null;
    const text = fresh ? fillVariables(fresh, values).text : filled.text;
    if (how === 'copy') await copy(text, context, 'Prompt copied');
    else navigate(`/ai/new?prompt=${encodeURIComponent(text)}`);
  };
  return (
    <div className="stack-3">
      {vars.length ? (
        <div className="stack-3">
          {vars.map((v) => (
            <Field key={v.name} label={variableLabel(v.name)} hint={v.defaultValue !== null ? `Default: ${v.defaultValue || '(empty)'}` : 'Required'} htmlFor={`pv-${v.name}`}>
              {/text|notes|code|paragraph|message|proposal|tasks|facts/i.test(v.name) ? (
                <Textarea id={`pv-${v.name}`} rows={3} value={values[v.name] ?? ''} placeholder={v.defaultValue ?? ''} onChange={(e) => setValues({ ...values, [v.name]: e.target.value })} />
              ) : (
                <Input id={`pv-${v.name}`} value={values[v.name] ?? ''} placeholder={v.defaultValue ?? ''} onChange={(e) => setValues({ ...values, [v.name]: e.target.value })} />
              )}
            </Field>
          ))}
        </div>
      ) : (
        <p className="small muted">This prompt has no variables.</p>
      )}
      <details>
        <summary className="small muted" style={{ cursor: 'pointer' }}>
          Preview the final prompt
        </summary>
        <pre className="prompt-preview">{filled.text}</pre>
      </details>
      {onAttach ? (
        <div className="row-wrap">
          <Button
            variant="primary"
            icon={<Sparkles size={14} />}
            onClick={() => {
              if (filled.missing.length) toast(`Fill in: ${filled.missing.map(variableLabel).join(', ')}`, 'error');
              else {
                void onUse?.('insert');
                onAttach(filled.text);
              }
            }}
          >
            Attach to message
          </Button>
        </div>
      ) : (
      <div className="row-wrap">
        {settings.layout.modules.ai ? (
          <Button variant="primary" icon={<Sparkles size={14} />} onClick={() => void go('insert')}>
            Open in AI workspace
          </Button>
        ) : null}
        <Button icon={<ClipboardCopy size={14} />} onClick={() => void go('copy')}>
          Copy
        </Button>
      </div>
      )}
    </div>
  );
}
