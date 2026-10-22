import { useEffect, useRef, useState } from 'react';
import { GameFrame, recordScore, useGameStats } from './common';

type Phase = 'idle' | 'waiting' | 'go' | 'result' | 'early';

export function Reaction() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [ms, setMs] = useState<number | null>(null);
  const [round, setRound] = useState<number[]>([]);
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stats = useGameStats('reaction');

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const start = () => {
    setPhase('waiting');
    setMs(null);
    timer.current = setTimeout(() => {
      goAt.current = performance.now();
      setPhase('go');
    }, 1500 + Math.random() * 2500);
  };
  const act = () => {
    if (phase === 'idle' || phase === 'result' || phase === 'early') return start();
    if (phase === 'waiting') {
      if (timer.current) clearTimeout(timer.current);
      return setPhase('early');
    }
    const t = Math.round(performance.now() - goAt.current);
    setMs(t);
    setPhase('result');
    const next = [...round, t].slice(-5);
    setRound(next);
    void recordScore('reaction', t, { won: true });
  };

  const bg = phase === 'go' ? 'var(--ok)' : phase === 'waiting' ? 'var(--danger)' : phase === 'early' ? 'var(--warn)' : 'var(--surface-2)';
  const text =
    phase === 'idle'
      ? 'Click or press Space to start'
      : phase === 'waiting'
        ? 'Wait for green…'
        : phase === 'go'
          ? 'Now!'
          : phase === 'early'
            ? 'Too soon! Click to try again.'
            : `${ms} ms — click to go again`;
  const avg = round.length ? Math.round(round.reduce((a, b) => a + b, 0) / round.length) : null;

  return (
    <GameFrame
      title="Reaction time"
      onRestart={() => (setPhase('idle'), setRound([]))}
      rules={<p>When the panel turns green, click it or press Space as fast as you can. Clicking while it is red counts as a false start. Colour changes are paired with text for accessibility.</p>}
      stats={stats.data ? <>Played {stats.data.played} · best {stats.data.best ? `${stats.data.best.score} ms` : '—'}{avg ? ` · last ${round.length} average ${avg} ms` : ''}</> : null}
    >
      <button
        type="button"
        onMouseDown={act}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            act();
          }
        }}
        aria-live="assertive"
        style={{ width: '100%', height: 320, borderRadius: 14, border: 0, background: bg, color: phase === 'idle' || phase === 'result' ? 'var(--text)' : '#0e1016', fontSize: '1.6rem', fontWeight: 700, cursor: 'pointer' }}
      >
        {text}
      </button>
    </GameFrame>
  );
}
