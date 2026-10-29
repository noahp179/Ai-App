import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ExternalLink, ImageOff, ShieldCheck } from 'lucide-react';
import { Fragment, memo, type ReactNode } from 'react';
import type { Block, Diagram } from '../../../shared/study/types';
import { api } from '../../lib/api';

/** Renders LaTeX with KaTeX. Bad LaTeX is shown as plain text instead of failing. */
export const Tex = memo(function Tex({ latex, display = false }: { latex: string; display?: boolean }) {
  let html: string;
  try {
    html = katex.renderToString(latex, { throwOnError: true, displayMode: display, strict: 'ignore', trust: false, output: 'htmlAndMathml' });
  } catch {
    return <code>{latex}</code>;
  }
  // KaTeX output is generated from the formula, never from page content, and `trust: false` blocks links and HTML.
  return <span className={display ? 'tex-display' : 'tex'} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Inline text with **bold**, *italic* and $$math$$. Everything else is plain text. */
export function RichLine({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) parts.push(<Tex key={k++} latex={m[1]} />);
    else if (m[2] !== undefined) parts.push(<strong key={k++}>{m[2]}</strong>);
    else parts.push(<em key={k++}>{m[3]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

const ALLOWED = new Set(['P', 'UL', 'OL', 'LI', 'EM', 'STRONG', 'SUP', 'SUB', 'BR', 'SPAN']);

/**
 * Official Ministry text arrives as a restricted HTML subset. It is parsed (never injected) and only the allowed
 * elements are turned into React elements; anything else becomes its text.
 */
export function OfficialHtml({ html }: { html: string }) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const walk = (n: Node, key: string): ReactNode => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n.textContent ?? '';
      return t.includes('$$') ? <RichLine key={key} text={t} /> : t;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return null;
    const el = n as Element;
    const kids = [...el.childNodes].map((c, i) => walk(c, `${key}.${i}`));
    if (!ALLOWED.has(el.tagName)) return <Fragment key={key}>{kids}</Fragment>;
    switch (el.tagName) {
      case 'P':
        return <p key={key}>{kids}</p>;
      case 'UL':
        return <ul key={key}>{kids}</ul>;
      case 'OL':
        return <ol key={key}>{kids}</ol>;
      case 'LI':
        return <li key={key}>{kids}</li>;
      case 'EM':
        return <em key={key}>{kids}</em>;
      case 'STRONG':
        return <strong key={key}>{kids}</strong>;
      case 'SUP':
        return <sup key={key}>{kids}</sup>;
      case 'SUB':
        return <sub key={key}>{kids}</sub>;
      case 'BR':
        return <br key={key} />;
      default:
        return (
          <span key={key} className="term">
            {kids}
          </span>
        );
    }
  };
  return <div className="official-html">{[...doc.body.firstChild!.childNodes].map((c, i) => walk(c, String(i)))}</div>;
}

export function SourceLink({ url, label = 'Source' }: { url: string; label?: string }) {
  return (
    <button type="button" className="link-button tiny" onClick={() => void api.app.openExternal(url)} title={url}>
      {label} <ExternalLink size={11} />
    </button>
  );
}

export function OfficialBox({ index, course, html, url }: { index: string; course: string; html: string; url: string }) {
  return (
    <figure className="official" aria-label={`Official expectation ${index}`}>
      <figcaption className="row tiny">
        <ShieldCheck size={13} color="var(--ok)" />
        <span className="grow">
          Ontario curriculum · {course} · <strong>{index}</strong>
        </span>
        <SourceLink url={url} label="Ministry page" />
      </figcaption>
      <OfficialHtml html={html} />
    </figure>
  );
}

export function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case 'p':
      return (
        <p>
          <RichLine text={b.text} />
        </p>
      );
    case 'math':
      return <Tex latex={b.latex} display />;
    case 'list': {
      const items = b.items.map((it, i) => (
        <li key={i}>
          <RichLine text={it} />
        </li>
      ));
      return b.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case 'note':
      return (
        <div className={`lesson-note ${b.tone}`}>
          <RichLine text={b.text} />
        </div>
      );
    case 'steps':
      return (
        <ol className="lesson-steps">
          {b.steps.map((s, i) => (
            <li key={i}>
              <RichLine text={s.text} />
              {s.math ? <Tex latex={s.math} display /> : null}
            </li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {b.header.map((h, i) => (
                  <th key={i}>
                    <RichLine text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>
                      <RichLine text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'code':
      return (
        <pre className="code-snippet" aria-label={`${b.language} code`}>
          <code>{b.code}</code>
        </pre>
      );
    case 'diagram':
      return (
        <figure className="diagram">
          <DiagramView d={b.diagram} alt={b.alt} />
          <figcaption className="tiny faint">{b.alt}</figcaption>
        </figure>
      );
    case 'official':
      return <OfficialBox index={b.index} course={b.course} html={b.html} url={b.url} />;
    case 'support':
      return (
        <figure className="support">
          <figcaption className="row tiny">
            <ShieldCheck size={13} color="var(--ok)" />
            <span className="grow">Ministry teacher support · {b.label}</span>
            <SourceLink url={b.url} label="Ministry page" />
          </figcaption>
          <OfficialHtml html={b.html} />
          {b.omittedMedia ? (
            <p className="tiny faint row" style={{ gap: 4 }}>
              <ImageOff size={12} /> An image or embedded item was left out. See it on the Ministry page.
            </p>
          ) : null}
        </figure>
      );
  }
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="blocks">
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} />
      ))}
    </div>
  );
}

const STROKE = 'var(--text-muted)';
const FILL = 'var(--accent)';

/** Simple, accessible SVG diagrams. The figure caption carries the same information in words. */
export function DiagramView({ d, alt }: { d: Diagram; alt: string }) {
  const svg = (w: number, h: number, children: ReactNode) => (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }} role="img" aria-label={alt}>
      {children}
    </svg>
  );
  switch (d.type) {
    case 'fraction_bar': {
      const w = 320;
      const pw = w / d.parts;
      return svg(
        w + 70,
        44,
        <>
          {Array.from({ length: d.parts }, (_, i) => (
            <rect key={i} x={i * pw + 1} y={6} width={pw - 2} height={30} rx={3} fill={i < d.shaded ? FILL : 'transparent'} fillOpacity={i < d.shaded ? 0.55 : 0} stroke={STROKE} />
          ))}
          {d.label ? (
            <text x={w + 10} y={26} fill="currentColor" fontSize={14}>
              {d.label}
            </text>
          ) : null}
        </>,
      );
    }
    case 'number_line': {
      const w = 420;
      const pad = 24;
      const x = (v: number) => pad + ((v - d.min) / (d.max - d.min || 1)) * (w - 2 * pad);
      const ticks: number[] = [];
      for (let v = d.min; v <= d.max + 1e-9 && ticks.length < 60; v += d.step || 1) ticks.push(Math.round(v * 1000) / 1000);
      return svg(
        w,
        90,
        <>
          <line x1={pad - 10} x2={w - pad + 10} y1={55} y2={55} stroke={STROKE} strokeWidth={1.5} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={50} y2={60} stroke={STROKE} />
              <text x={x(t)} y={76} fontSize={11} textAnchor="middle" fill="currentColor">
                {t}
              </text>
            </g>
          ))}
          {(d.jumps ?? []).map((j, i) => (
            <g key={i}>
              <path d={`M ${x(j.from)} 50 Q ${(x(j.from) + x(j.to)) / 2} ${18 + (i % 2) * 6} ${x(j.to)} 50`} fill="none" stroke={FILL} strokeWidth={2} />
              <text x={(x(j.from) + x(j.to)) / 2} y={16 + (i % 2) * 6} fontSize={11} textAnchor="middle" fill="currentColor">
                {j.label}
              </text>
            </g>
          ))}
          {d.points.map((p, i) => (
            <g key={i}>
              <circle cx={x(p.at)} cy={55} r={5} fill={FILL} />
              <text x={x(p.at)} y={42} fontSize={11} textAnchor="middle" fill="currentColor">
                {p.label}
              </text>
            </g>
          ))}
        </>,
      );
    }
    case 'area_model': {
      const cw = Math.min(28, 280 / d.cols);
      const ch = Math.min(28, 200 / d.rows);
      return svg(
        d.cols * cw + 4,
        d.rows * ch + 4,
        <>
          {Array.from({ length: d.rows }, (_, r) =>
            Array.from({ length: d.cols }, (_, c) => {
              const both = r < d.shadedRows && c < d.shadedCols;
              const one = r < d.shadedRows || c < d.shadedCols;
              return <rect key={`${r}-${c}`} x={2 + c * cw} y={2 + r * ch} width={cw} height={ch} fill={FILL} fillOpacity={both ? 0.7 : one && d.shadedRows < d.rows && d.shadedCols < d.cols ? 0.18 : 0} stroke={STROKE} strokeWidth={0.7} />;
            }),
          )}
        </>,
      );
    }
    case 'right_triangle':
      return svg(
        260,
        170,
        <>
          <polygon points="30,140 230,140 30,20" fill={FILL} fillOpacity={0.12} stroke={STROKE} strokeWidth={2} />
          <rect x={30} y={126} width={14} height={14} fill="none" stroke={STROKE} />
          <text x={130} y={160} textAnchor="middle" fontSize={14} fill="currentColor">
            {d.b}
          </text>
          <text x={14} y={84} textAnchor="middle" fontSize={14} fill="currentColor">
            {d.a}
          </text>
          <text x={142} y={72} textAnchor="middle" fontSize={14} fill="currentColor">
            {d.c}
          </text>
        </>,
      );
    case 'circle':
      return svg(
        200,
        180,
        <>
          <circle cx={100} cy={90} r={70} fill={FILL} fillOpacity={0.1} stroke={STROKE} strokeWidth={2} />
          <circle cx={100} cy={90} r={3} fill="currentColor" />
          {d.show === 'radius' ? <line x1={100} y1={90} x2={170} y2={90} stroke={FILL} strokeWidth={2} /> : <line x1={30} y1={90} x2={170} y2={90} stroke={FILL} strokeWidth={2} />}
          <text x={d.show === 'radius' ? 135 : 100} y={82} textAnchor="middle" fontSize={14} fill="currentColor">
            {d.label}
          </text>
        </>,
      );
    case 'coordinate': {
      const all = [...d.points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]), 5];
      const r = Math.min(12, Math.max(...all) + 1);
      const s = 220;
      const k = s / 2 / r;
      const X = (v: number) => s / 2 + v * k + 10;
      const Y = (v: number) => s / 2 - v * k + 10;
      const grid: ReactNode[] = [];
      for (let i = -r; i <= r; i++) {
        grid.push(<line key={`v${i}`} x1={X(i)} x2={X(i)} y1={Y(-r)} y2={Y(r)} stroke={STROKE} strokeOpacity={i === 0 ? 0.9 : 0.18} />);
        grid.push(<line key={`h${i}`} y1={Y(i)} y2={Y(i)} x1={X(-r)} x2={X(r)} stroke={STROKE} strokeOpacity={i === 0 ? 0.9 : 0.18} />);
      }
      return svg(
        s + 20,
        s + 20,
        <>
          {grid}
          {d.line ? <line x1={X(-r)} y1={Y(d.line.m * -r + d.line.b)} x2={X(r)} y2={Y(d.line.m * r + d.line.b)} stroke={FILL} strokeWidth={2} /> : null}
          {d.points.map((p, i) => (
            <g key={i}>
              <circle cx={X(p.x)} cy={Y(p.y)} r={4} fill={FILL} />
              <text x={X(p.x) + 6} y={Y(p.y) - 6} fontSize={12} fill="currentColor">
                {p.label}
              </text>
            </g>
          ))}
        </>,
      );
    }
    case 'angle_pair': {
      const rad = (deg: number) => (deg * Math.PI) / 180;
      const cx = 130;
      const cy = 110;
      const L = 100;
      const ray = (deg: number) => <line x1={cx} y1={cy} x2={cx + L * Math.cos(rad(deg))} y2={cy - L * Math.sin(rad(deg))} stroke={STROKE} strokeWidth={2} />;
      const known = d.known;
      return svg(
        260,
        140,
        <>
          {d.kind === 'complementary' ? (
            <>
              {ray(0)}
              {ray(90)}
              {ray(known)}
              <rect x={cx} y={cy - 14} width={14} height={14} fill="none" stroke={STROKE} strokeOpacity={0.5} />
            </>
          ) : d.kind === 'supplementary' ? (
            <>
              {ray(0)}
              {ray(180)}
              {ray(known)}
            </>
          ) : (
            <>
              {ray(known)}
              {ray(known + 180)}
              {ray(0)}
              {ray(180)}
            </>
          )}
          <text x={cx + 34 * Math.cos(rad(known / 2))} y={cy - 34 * Math.sin(rad(known / 2)) + 4} fontSize={12} fill="currentColor">
            {known}°
          </text>
          <text x={cx + 40 * Math.cos(rad(d.kind === 'complementary' ? (known + 90) / 2 : d.kind === 'supplementary' ? (known + 180) / 2 : known / 2 + 180))} y={cy - 40 * Math.sin(rad(d.kind === 'complementary' ? (known + 90) / 2 : d.kind === 'supplementary' ? (known + 180) / 2 : known / 2 + 180)) + 4} fontSize={13} fill="currentColor">
            {d.unknownLabel}
          </text>
        </>,
      );
    }
    case 'prism':
      return svg(
        260,
        170,
        <>
          <polygon points="40,60 170,60 170,150 40,150" fill={FILL} fillOpacity={0.12} stroke={STROKE} strokeWidth={2} />
          <polygon points="40,60 80,25 210,25 170,60" fill={FILL} fillOpacity={0.2} stroke={STROKE} strokeWidth={2} />
          <polygon points="170,60 210,25 210,115 170,150" fill={FILL} fillOpacity={0.06} stroke={STROKE} strokeWidth={2} />
          <text x={105} y={166} textAnchor="middle" fontSize={12} fill="currentColor">
            {d.l} {d.unit}
          </text>
          <text x={200} y={140} fontSize={12} fill="currentColor">
            {d.w} {d.unit}
          </text>
          <text x={24} y={108} textAnchor="end" fontSize={12} fill="currentColor">
            {d.h} {d.unit}
          </text>
        </>,
      );
  }
}
