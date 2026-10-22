import { Anchor, Bell, Camera, Cloud, Coffee, Feather, Flame, Gift, Heart, Key, Leaf, Moon, Music, Rocket, Star, Sun, Umbrella, Zap, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type MemorySymbol, type MemoryState, closeOpen, flip, newMemoryGame } from '../../../shared/games/memory';
import { mulberry32, randomSeed } from '../../../shared/games/rng';
import { Segmented } from '../../components/ui';
import { fmtDuration } from '../../lib/format';
import { reducedMotion, useSettings } from '../../lib/settings';
import { GameFrame, recordScore, useGameStats } from './common';

const ICONS: Record<MemorySymbol, LucideIcon> = { star: Star, heart: Heart, moon: Moon, sun: Sun, cloud: Cloud, leaf: Leaf, flame: Flame, zap: Zap, anchor: Anchor, bell: Bell, camera: Camera, gift: Gift, key: Key, music: Music, feather: Feather, umbrella: Umbrella, coffee: Coffee, rocket: Rocket };

export function Memory() {
  const { settings } = useSettings();
  const [pairs, setPairs] = useState<6 | 8 | 12>(8);
  const [s, setS] = useState<MemoryState>(() => newMemoryGame(8, mulberry32(randomSeed())));
  const started = useRef<number | null>(null);
  const [, tick] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const stats = useGameStats('memory', { key: 'pairs', value: String(pairs) });
  const reduce = reducedMotion(settings);

  useEffect(() => {
    if (s.open.length !== 2) return;
    const t = setTimeout(() => setS((x) => closeOpen(x)), reduce ? 1200 : 800);
    return () => clearTimeout(t);
  }, [s.open, reduce]);
  useEffect(() => {
    if (!started.current || s.done) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [s.done, s.moves]);

  const restart = (p = pairs) => {
    started.current = null;
    setElapsed(0);
    setS(newMemoryGame(p, mulberry32(randomSeed())));
  };
  const click = (id: number) => {
    if (s.open.length === 2) return;
    if (!started.current) started.current = Date.now();
    const next = flip(s, id);
    if (next.done && !s.done) {
      const ms = Date.now() - started.current;
      setElapsed(ms);
      void recordScore('memory', next.moves, { pairs, seconds: Math.round(ms / 1000), won: true });
    }
    setS(next);
  };
  const cols = pairs === 12 ? 6 : 4;
  const now = s.done ? elapsed : started.current ? Date.now() - started.current : 0;

  return (
    <GameFrame
      title="Memory match"
      onRestart={() => restart()}
      rules={<p>Turn over two cards at a time and find all matching pairs in as few moves as you can.</p>}
      stats={stats.data ? <>Played {stats.data.played} with {pairs} pairs · best {stats.data.best ? `${stats.data.best.score} moves` : '—'}</> : null}
    >
      <div className="row-wrap" style={{ marginBottom: 12 }}>
        <Segmented
          label="Board size"
          value={String(pairs) as '6' | '8' | '12'}
          onChange={(v) => {
            const p = Number(v) as 6 | 8 | 12;
            setPairs(p);
            restart(p);
          }}
          options={[
            { value: '6', label: '6 pairs' },
            { value: '8', label: '8 pairs' },
            { value: '12', label: '12 pairs' },
          ]}
        />
        <span className="spacer" />
        <span className="small muted">
          Moves {s.moves} · {fmtDuration(now)}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, maxWidth: cols * 92 }} role="grid" aria-label="Cards">
        {s.cards.map((c) => {
          const up = c.matched || s.open.includes(c.id);
          const Icon = ICONS[c.symbol];
          return (
            <button
              key={c.id}
              type="button"
              role="gridcell"
              aria-label={up ? `${c.symbol}${c.matched ? ', matched' : ''}` : `Hidden card ${c.id + 1}`}
              disabled={c.matched}
              onClick={() => click(c.id)}
              style={{
                aspectRatio: '1',
                borderRadius: 10,
                border: `1px solid ${up ? 'var(--accent)' : 'var(--border-strong)'}`,
                background: c.matched ? 'var(--ok-bg)' : up ? 'var(--accent-bg)' : 'var(--surface-2)',
                display: 'grid',
                placeItems: 'center',
                cursor: c.matched ? 'default' : 'pointer',
                transition: reduce ? 'none' : 'background 180ms ease, transform 180ms ease',
                transform: up && !reduce ? 'scale(1.03)' : 'none',
                color: c.matched ? 'var(--ok)' : 'var(--accent)',
              }}
            >
              {up ? <Icon size={28} /> : null}
            </button>
          );
        })}
      </div>
      {s.done ? (
        <p className="ok-text" role="status" style={{ marginTop: 12, fontWeight: 600 }}>
          All pairs found in {s.moves} moves and {fmtDuration(elapsed)}.
        </p>
      ) : null}
    </GameFrame>
  );
}
