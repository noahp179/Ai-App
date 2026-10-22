import { useEffect, useState, type ReactNode } from 'react';
import { Field, Input, Select, Toggle, useToast } from '../../components/ui';
import { errorMessage } from '../../lib/api';

export function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="card stack-4" aria-label={title}>
      <div>
        <h2 style={{ fontSize: '1.05rem' }}>{title}</h2>
        {description ? <p className="small muted" style={{ marginTop: 4 }}>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Number input that validates and saves on blur/Enter, keeping the old value on error. */
export function NumberSetting({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  suffix,
  onSave,
}: {
  label: string;
  hint?: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onSave: (v: number) => Promise<unknown>;
}) {
  const toast = useToast();
  const [v, setV] = useState(String(value));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setV(String(value)), [value]);
  const id = `n-${label.replace(/\W+/g, '-')}`;
  const commit = async () => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) {
      setErr(`Enter a number from ${min} to ${max}.`);
      return;
    }
    setErr(null);
    if (n === value) return;
    try {
      await onSave(n);
    } catch (e) {
      toast(errorMessage(e), 'error');
      setV(String(value));
    }
  };
  return (
    <Field label={label} hint={hint} error={err} htmlFor={id}>
      <div className="row">
        <Input id={id} type="number" min={min} max={max} step={step} value={v} aria-invalid={!!err} onChange={(e) => setV(e.target.value)} onBlur={() => void commit()} onKeyDown={(e) => e.key === 'Enter' && void commit()} style={{ width: 120 }} />
        {suffix ? <span className="small muted">{suffix}</span> : null}
      </div>
    </Field>
  );
}

export function SelectSetting<T extends string | number>({ label, hint, value, options, onSave }: { label: string; hint?: ReactNode; value: T; options: { value: T; label: string }[]; onSave: (v: T) => Promise<unknown> }) {
  const toast = useToast();
  const id = `s-${label.replace(/\W+/g, '-')}`;
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <Select
        id={id}
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const opt = options.find((o) => String(o.value) === raw);
          if (opt) void onSave(opt.value).catch((err: unknown) => toast(errorMessage(err), 'error'));
        }}
        style={{ maxWidth: 360 }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Switch that flips immediately and reverts if saving fails. */
export function ToggleSetting({ label, description, value, disabled, onSave }: { label: string; description?: ReactNode; value: boolean; disabled?: boolean; onSave: (v: boolean) => Promise<unknown> }) {
  const toast = useToast();
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <Toggle
      checked={local}
      disabled={disabled}
      label={label}
      description={description}
      onChange={(v) => {
        setLocal(v);
        void onSave(v).catch((err: unknown) => {
          setLocal(!v);
          toast(errorMessage(err), 'error');
        });
      }}
    />
  );
}

export function TextSetting({ label, hint, value, placeholder, onSave, multiline }: { label: string; hint?: ReactNode; value: string; placeholder?: string; multiline?: boolean; onSave: (v: string) => Promise<unknown> }) {
  const toast = useToast();
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const id = `t-${label.replace(/\W+/g, '-')}`;
  const commit = () => v !== value && void onSave(v).catch((err: unknown) => (toast(errorMessage(err), 'error'), setV(value)));
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      {multiline ? (
        <textarea id={id} className="textarea" rows={4} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} />
      ) : (
        <Input id={id} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
      )}
    </Field>
  );
}
