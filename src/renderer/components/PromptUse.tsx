import { ClipboardCopy, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CopyContext } from '../../shared/api';
import { fillVariables, parseVariables } from '../../shared/prompts';
import { useCopy } from '../lib/copy';
import { navigate } from '../lib/router';
import { useSettings } from '../lib/settings';
import { Button, Field, Input, Textarea, useToast } from './ui';

/** Fill in a prompt's {{variables}}, then open it in the AI workspace or copy it. */
export function PromptUse({ body, context, onUse }: { body: string; context: CopyContext; onUse?: (how: 'insert' | 'copy') => Promise<string | void> | void }) {
  const { settings } = useSettings();
  const toast = useToast();
  const copy = useCopy();
  const vars = useMemo(() => parseVariables(body), [body]);
  const [values, setValues] = useState<Record<string, string>>({});
  const filled = fillVariables(body, values);
  const go = async (how: 'insert' | 'copy') => {
    if (filled.missing.length) {
      toast(`Fill in: ${filled.missing.join(', ')}`, 'error');
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
            <Field key={v.name} label={v.name} hint={v.defaultValue !== null ? `Default: ${v.defaultValue || '(empty)'}` : 'Required'} htmlFor={`pv-${v.name}`}>
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
    </div>
  );
}
