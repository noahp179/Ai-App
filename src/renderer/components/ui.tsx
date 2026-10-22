import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';

type BtnVariant = 'default' | 'primary' | 'ghost' | 'danger' | 'danger-solid';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = 'default', size = 'md', loading, icon, className = '', children, disabled, type = 'button', ...rest }, ref) {
  const cls = ['btn', variant === 'danger-solid' ? 'danger solid' : variant === 'default' ? '' : variant, size === 'md' ? '' : size, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  active,
  size,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; size?: 'sm' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={['icon-btn', active ? 'active' : '', size ?? '', className].filter(Boolean).join(' ')}
      aria-pressed={active}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <div className="error" role="alert">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...rest }, ref) {
  return <input ref={ref} className={`input ${className}`} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = '', ...rest }, ref) {
  return <textarea ref={ref} className={`textarea ${className}`} {...rest} />;
});

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`select ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
      <label className={`toggle ${disabled ? 'disabled' : ''}`} htmlFor={id} style={{ marginTop: 2 }}>
        <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="track" aria-hidden />
      </label>
      <label htmlFor={id} className="grow" style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <div style={{ fontWeight: 540 }}>{label}</div>
        {description ? <div className="small muted">{description}</div> : null}
      </label>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, tabs, onChange, label }: { value: T; tabs: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={t.value === value} onClick={() => onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ tone, children, title }: { tone?: 'accent' | 'ok' | 'warn' | 'danger' | 'info' | 'outline'; children: ReactNode; title?: string }) {
  return (
    <span className={`badge ${tone ?? ''}`} title={title}>
      {children}
    </span>
  );
}

export function Banner({ tone = 'info', children, title }: { tone?: 'info' | 'warn' | 'danger' | 'ok' | 'demo'; children: ReactNode; title?: ReactNode }) {
  const Icon = tone === 'danger' ? XCircle : tone === 'ok' ? CheckCircle2 : tone === 'warn' || tone === 'demo' ? AlertTriangle : Info;
  return (
    <div className={`banner ${tone}`} role={tone === 'danger' ? 'alert' : 'note'}>
      <Icon size={16} aria-hidden />
      <div className="grow">
        {title ? <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading', large }: { label?: string; large?: boolean }) {
  return <span className={`spinner ${large ? 'lg' : ''}`} role="status" aria-label={label} />;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-block" role="status">
      <span className="spinner" aria-hidden />
      {label}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error | string; onRetry?: () => void }) {
  return (
    <div style={{ padding: 16 }}>
      <Banner tone="danger" title="Could not load this">
        <div className="col">
          <span>{typeof error === 'string' ? error : error.message}</span>
          {onRetry ? (
            <div>
              <Button size="sm" onClick={onRetry}>
                Try again
              </Button>
            </div>
          ) : null}
        </div>
      </Banner>
    </div>
  );
}

// ─────────── Modal ───────────

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  initialFocus,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  initialFocus?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previously = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = (initialFocus ? el?.querySelector<HTMLElement>(initialFocus) : null) ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
        if (items.length === 0) return;
        const firstItem = items[0]!;
        const lastItem = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          firstItem.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previously?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-header">
          <h2 id={titleId} className="grow" style={{ fontSize: '1.05rem' }}>
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

// ─────────── Confirm dialog (promise based) ───────────

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback<ConfirmFn>((o) => new Promise((resolve) => setPending({ ...o, resolve })), []);
  const close = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {pending ? (
        <Modal
          title={pending.title}
          onClose={() => close(false)}
          initialFocus="[data-confirm]"
          footer={
            <>
              <Button onClick={() => close(false)}>Cancel</Button>
              <Button data-confirm variant={pending.danger ? 'danger-solid' : 'primary'} onClick={() => close(true)}>
                {pending.confirmLabel ?? 'Confirm'}
              </Button>
            </>
          }
        >
          <div className="muted">{pending.message}</div>
        </Modal>
      ) : null}
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);

// ─────────── Toasts ───────────

interface Toast {
  id: number;
  tone: 'info' | 'success' | 'error';
  message: ReactNode;
}
type ToastFn = (message: ReactNode, tone?: Toast['tone']) => void;
const ToastCtx = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback<ToastFn>((message, tone = 'info') => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            {t.tone === 'error' ? <XCircle size={16} color="var(--danger)" /> : t.tone === 'success' ? <CheckCircle2 size={16} color="var(--ok)" /> : <Info size={16} color="var(--info)" />}
            <div className="grow">{t.message}</div>
            <IconButton label="Dismiss" size="sm" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              <X size={14} />
            </IconButton>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─────────── Dropdown menu ───────────

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** A small accessible dropdown for secondary actions. */
export function Menu({ label, icon, items }: { label: string; icon: ReactNode; items: (MenuItem | null)[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const list = items.filter((x): x is MenuItem => x !== null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const els = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
        const i = els.indexOf(document.activeElement as HTMLButtonElement);
        els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <IconButton label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {icon}
      </IconButton>
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="card"
          style={{ position: 'absolute', right: 0, top: 34, zIndex: 40, padding: 4, minWidth: 210, boxShadow: 'var(--shadow)' }}
        >
          {list.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className="list-item"
              disabled={it.disabled}
              style={{ color: it.danger ? 'var(--danger)' : undefined, padding: '7px 10px' }}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─────────── Text prompt dialog (Electron has no window.prompt) ───────────

interface PromptOptions {
  title: string;
  label: string;
  initial?: string;
  confirmLabel?: string;
}
type PromptFn = (o: PromptOptions) => Promise<string | null>;
const PromptCtx = createContext<PromptFn>(async () => null);

export function PromptProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(PromptOptions & { resolve: (v: string | null) => void }) | null>(null);
  const [value, setValue] = useState('');
  const ask = useCallback<PromptFn>(
    (o) =>
      new Promise((resolve) => {
        setValue(o.initial ?? '');
        setPending({ ...o, resolve });
      }),
    [],
  );
  const close = (v: string | null) => {
    pending?.resolve(v);
    setPending(null);
  };
  return (
    <PromptCtx.Provider value={ask}>
      {children}
      {pending ? (
        <Modal
          title={pending.title}
          onClose={() => close(null)}
          initialFocus="input"
          footer={
            <>
              <Button onClick={() => close(null)}>Cancel</Button>
              <Button variant="primary" disabled={!value.trim()} onClick={() => close(value.trim())}>
                {pending.confirmLabel ?? 'OK'}
              </Button>
            </>
          }
        >
          <Field label={pending.label} htmlFor="prompt-input">
            <Input
              id="prompt-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && value.trim()) close(value.trim());
              }}
            />
          </Field>
        </Modal>
      ) : null}
    </PromptCtx.Provider>
  );
}

export const usePrompt = () => useContext(PromptCtx);
