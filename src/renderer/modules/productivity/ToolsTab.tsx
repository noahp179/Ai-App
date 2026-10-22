import { ArrowLeftRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { evaluate, formatNumber } from '../../../shared/calc';
import { UNIT_CATEGORIES, convert } from '../../../shared/units';
import { Field, IconButton, Input, Select } from '../../components/ui';
import { useCopy } from '../../lib/copy';

function Calculator() {
  const [expr, setExpr] = useState('');
  const [history, setHistory] = useState<{ expr: string; result: string }[]>([]);
  const copy = useCopy();
  const result = useMemo(() => {
    if (!expr.trim()) return { ok: true, text: '' };
    try {
      return { ok: true, text: formatNumber(evaluate(expr)) };
    } catch (err) {
      return { ok: false, text: err instanceof Error ? err.message : 'Invalid' };
    }
  }, [expr]);
  return (
    <div className="card stack-3">
      <h3>Calculator</h3>
      <Input
        aria-label="Expression"
        placeholder="e.g. (12.5 + 7) * 3 ^ 2 or sqrt(2)"
        value={expr}
        className="mono"
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && result.ok && result.text) {
            setHistory((h) => [{ expr, result: result.text }, ...h].slice(0, 10));
            setExpr(result.text);
          }
        }}
      />
      <div className="row" style={{ minHeight: 36 }}>
        <span className={`mono grow ${result.ok ? '' : 'danger-text small'}`} style={{ fontSize: result.ok ? '1.5rem' : undefined, fontWeight: 700 }} aria-live="polite">
          {result.ok && result.text ? `= ${result.text}` : result.text}
        </span>
        {result.ok && result.text ? (
          <button type="button" className="btn sm ghost" onClick={() => void copy(result.text, 'general', 'Result copied')}>
            Copy
          </button>
        ) : null}
      </div>
      <div className="tiny faint">Supports + − × ÷ % ^, parentheses, pi, e, sqrt, abs, round, floor, ceil, sin, cos, tan, ln, log, exp. Press Enter to keep a result.</div>
      {history.length ? (
        <div className="col small" style={{ gap: 2 }}>
          {history.map((h, i) => (
            <button key={i} type="button" className="list-item mono" style={{ padding: '2px 6px' }} onClick={() => setExpr(h.expr)}>
              <span className="grow faint">{h.expr}</span> = {h.result}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Converter() {
  const [cat, setCat] = useState('length');
  const units = UNIT_CATEGORIES[cat]!.units;
  const [from, setFrom] = useState(units[2]?.id ?? units[0]!.id);
  const [to, setTo] = useState(units[3]?.id ?? units[0]!.id);
  const [value, setValue] = useState('1');
  const out = useMemo(() => {
    const n = Number(value);
    if (value.trim() === '' || !Number.isFinite(n)) return { ok: false, text: 'Enter a number' };
    try {
      return { ok: true, text: formatNumber(convert(n, cat, from, to)) };
    } catch (err) {
      return { ok: false, text: err instanceof Error ? err.message : 'Invalid' };
    }
  }, [value, cat, from, to]);
  return (
    <div className="card stack-3">
      <h3>Unit converter</h3>
      <Field label="Category" htmlFor="uc-cat">
        <Select
          id="uc-cat"
          value={cat}
          onChange={(e) => {
            const c = e.target.value;
            setCat(c);
            const u = UNIT_CATEGORIES[c]!.units;
            setFrom(u[0]!.id);
            setTo(u[1]?.id ?? u[0]!.id);
          }}
        >
          {Object.entries(UNIT_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <Field label="Value" htmlFor="uc-v">
          <Input id="uc-v" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Field label="From" htmlFor="uc-f">
          <Select id="uc-f" value={from} onChange={(e) => setFrom(e.target.value)}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        <IconButton label="Swap units" onClick={() => (setFrom(to), setTo(from))}>
          <ArrowLeftRight size={15} />
        </IconButton>
        <Field label="To" htmlFor="uc-t">
          <Select id="uc-t" value={to} onChange={(e) => setTo(e.target.value)}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className={`mono ${out.ok ? '' : 'small danger-text'}`} style={{ fontSize: out.ok ? '1.4rem' : undefined, fontWeight: 700 }} aria-live="polite">
        {out.ok ? `${out.text} ${units.find((u) => u.id === to)?.label.toLowerCase()}` : out.text}
      </div>
    </div>
  );
}

export function ToolsTab() {
  return (
    <div className="grid grid-2">
      <Calculator />
      <Converter />
    </div>
  );
}
