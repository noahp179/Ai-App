import { Eraser, Pencil } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { mulberry32, randomSeed } from '../../../shared/games/rng';
import { type Difficulty, type Grid, conflicts, generate, isSolved } from '../../../shared/games/sudoku';
import { Button, Segmented } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDuration } from '../../lib/format';
import { GameFrame, recordScore, useGameStats } from './common';

interface State {
  difficulty: Difficulty;
  puzzle: Grid;
  solution: Grid;
  cells: Grid;
  notes: number[][];
  elapsedMs: number;
  mistakes: number;
  done: boolean;
}

function fresh(difficulty: Difficulty): State {
  const { puzzle, solution } = generate(difficulty, mulberry32(randomSeed()));
  return { difficulty, puzzle, solution, cells: [...puzzle], notes: Array.from({ length: 81 }, () => []), elapsedMs: 0, mistakes: 0, done: false };
}

export function Sudoku() {
  const [s, setS] = useState<State | null>(null);
  const [sel, setSel] = useState(0);
  const [notesMode, setNotesMode] = useState(false);
  const startedAt = useRef(Date.now());
  const [, tick] = useState(0);
  const stats = useGameStats('sudoku', s ? { key: 'difficulty', value: s.difficulty } : undefined);

  // Resume an unfinished game.
  useEffect(() => {
    void api.games.loadState('sudoku').then((saved) => {
      const st = saved as State | null;
      setS(st && !st.done && Array.isArray(st.cells) && st.cells.length === 81 ? st : fresh('easy'));
      startedAt.current = Date.now();
    });
  }, []);
  useEffect(() => {
    if (!s || s.done) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [s]);
  const elapsed = s ? s.elapsedMs + (s.done ? 0 : Date.now() - startedAt.current) : 0;
  useEffect(() => {
    if (!s) return;
    const save = () => void api.games.saveState('sudoku', { ...s, elapsedMs: s.elapsedMs + (s.done ? 0 : Date.now() - startedAt.current) });
    const t = setTimeout(save, 400);
    return () => clearTimeout(t);
  }, [s]);

  const bad = useMemo(() => (s ? conflicts(s.cells) : new Set<number>()), [s]);
  if (!s) return null;

  const put = (v: number) => {
    if (s.done || s.puzzle[sel]) return;
    if (notesMode && v) {
      const notes = s.notes.map((n, i) => (i === sel ? (n.includes(v) ? n.filter((x) => x !== v) : [...n, v].sort()) : n));
      return setS({ ...s, notes });
    }
    const cells = [...s.cells];
    cells[sel] = v;
    const wrong = v !== 0 && v !== s.solution[sel];
    const done = isSolved(cells, s.solution);
    const next: State = { ...s, cells, mistakes: s.mistakes + (wrong ? 1 : 0), notes: s.notes.map((n, i) => (i === sel ? [] : n)), done };
    if (done) {
      const total = s.elapsedMs + Date.now() - startedAt.current;
      next.elapsedMs = total;
      void recordScore('sudoku', Math.round(total / 1000), { difficulty: s.difficulty, mistakes: next.mistakes, won: true });
      void api.games.clearState('sudoku');
    }
    setS(next);
  };

  const newGame = (d: Difficulty) => {
    startedAt.current = Date.now();
    setS(fresh(d));
    setSel(0);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const r = Math.floor(sel / 9);
    const c = sel % 9;
    if (e.key === 'ArrowUp') setSel(((r + 8) % 9) * 9 + c);
    else if (e.key === 'ArrowDown') setSel(((r + 1) % 9) * 9 + c);
    else if (e.key === 'ArrowLeft') setSel(r * 9 + ((c + 8) % 9));
    else if (e.key === 'ArrowRight') setSel(r * 9 + ((c + 1) % 9));
    else if (/^[1-9]$/.test(e.key)) put(Number(e.key));
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') put(0);
    else if (e.key.toLowerCase() === 'n') setNotesMode((v) => !v);
    else return;
    e.preventDefault();
  };

  const selVal = s.cells[sel];
  return (
    <GameFrame
      title="Sudoku"
      onRestart={() => newGame(s.difficulty)}
      rules={
        <>
          <p>Fill every row, column and 3×3 box with the digits 1–9. Every puzzle has exactly one solution.</p>
          <p>Use the arrow keys and number keys, or click. Press N for pencil notes. Clashing digits turn red. Your game is saved if you leave.</p>
        </>
      }
      stats={stats.data ? <>Played {stats.data.played} on {s.difficulty} · best {stats.data.best ? fmtDuration(stats.data.best.score * 1000) : '—'}</> : null}
    >
      <div className="row-wrap" style={{ marginBottom: 12 }}>
        <Segmented label="Difficulty" value={s.difficulty} onChange={(d) => newGame(d)} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
        <span className="spacer" />
        <span className="mono">{fmtDuration(elapsed)}</span>
        <span className="small muted">Mistakes: {s.mistakes}</span>
      </div>
      <div
        role="grid"
        aria-label="Sudoku board"
        tabIndex={0}
        onKeyDown={onKey}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', width: 'min(100%, 450px)', aspectRatio: '1', margin: '0 auto', border: '2px solid var(--text-muted)', borderRadius: 6, overflow: 'hidden' }}
      >
        {s.cells.map((v, i) => {
          const r = Math.floor(i / 9);
          const c = i % 9;
          const given = !!s.puzzle[i];
          const related = Math.floor(sel / 9) === r || sel % 9 === c || (Math.floor(r / 3) === Math.floor(sel / 27) && Math.floor(c / 3) === Math.floor((sel % 9) / 3));
          const same = !!v && v === selVal;
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-label={`Row ${r + 1}, column ${c + 1}: ${v || 'empty'}${given ? ', given' : ''}${bad.has(i) ? ', conflict' : ''}`}
              aria-selected={i === sel}
              tabIndex={-1}
              onClick={() => setSel(i)}
              style={{
                border: 0,
                borderRight: c % 3 === 2 && c < 8 ? '2px solid var(--text-muted)' : '1px solid var(--border)',
                borderBottom: r % 3 === 2 && r < 8 ? '2px solid var(--text-muted)' : '1px solid var(--border)',
                background: i === sel ? 'var(--accent-bg)' : same ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : related ? 'var(--surface-2)' : 'var(--surface)',
                color: bad.has(i) ? 'var(--danger)' : given ? 'var(--text)' : 'var(--accent)',
                fontWeight: given ? 700 : 560,
                fontSize: '1.25rem',
                cursor: 'pointer',
                padding: 0,
                position: 'relative',
              }}
            >
              {v ? (
                v
              ) : s.notes[i]!.length ? (
                <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', fontSize: '0.55rem', color: 'var(--text-faint)', width: '100%', height: '100%', placeItems: 'center' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <span key={n}>{s.notes[i]!.includes(n) ? n : ''}</span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="row-wrap" style={{ justifyContent: 'center', marginTop: 12 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <Button key={n} onClick={() => put(n)} disabled={s.done} style={{ width: 40 }}>
            {n}
          </Button>
        ))}
        <Button onClick={() => put(0)} icon={<Eraser size={14} />} aria-label="Erase" disabled={s.done} />
        <Button onClick={() => setNotesMode((v) => !v)} icon={<Pencil size={14} />} aria-pressed={notesMode} variant={notesMode ? 'primary' : 'default'}>
          Notes
        </Button>
      </div>
      {s.done ? (
        <p className="center ok-text" role="status" style={{ marginTop: 12, fontWeight: 600 }}>
          Solved in {fmtDuration(s.elapsedMs)} with {s.mistakes} mistake{s.mistakes === 1 ? '' : 's'}!
        </p>
      ) : null}
    </GameFrame>
  );
}
