import { Delete } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { mulberry32, randomSeed } from '../../../shared/games/rng';
import { MAX_GUESSES, type LetterState, evaluate, isWord, keyboardStates, pickAnswer } from '../../../shared/games/wordguess';
import { GameFrame, recordScore, useGameStats } from './common';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const COLOR: Record<LetterState, string> = { correct: 'var(--ok)', present: 'var(--warn)', absent: 'var(--surface-3)' };
const LABEL: Record<LetterState, string> = { correct: 'right place', present: 'in the word, wrong place', absent: 'not in the word' };

export function WordGuess() {
  const [answer, setAnswer] = useState(() => pickAnswer(mulberry32(randomSeed())));
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [message, setMessage] = useState('');
  const stats = useGameStats('wordguess');
  const won = guesses.includes(answer);
  const over = won || guesses.length >= MAX_GUESSES;

  const restart = () => {
    setAnswer(pickAnswer(mulberry32(randomSeed())));
    setGuesses([]);
    setCurrent('');
    setMessage('');
  };

  const submit = useCallback(() => {
    if (over) return;
    if (current.length !== 5) return setMessage('Use five letters.');
    if (!isWord(current)) return setMessage(`“${current.toUpperCase()}” is not in the word list.`);
    const next = [...guesses, current];
    setGuesses(next);
    setCurrent('');
    const marks = evaluate(current, answer).map((s, i) => `${current[i]!.toUpperCase()} ${LABEL[s]}`).join(', ');
    if (current === answer) {
      setMessage(`Solved in ${next.length}! ${marks}`);
      void recordScore('wordguess', next.length, { won: true, word: answer });
    } else if (next.length >= MAX_GUESSES) {
      setMessage(`Out of guesses. The word was ${answer.toUpperCase()}.`);
      void recordScore('wordguess', MAX_GUESSES + 1, { won: false, word: answer });
    } else setMessage(marks);
  }, [answer, current, guesses, over]);

  const press = useCallback(
    (k: string) => {
      if (over) return;
      if (k === 'enter') submit();
      else if (k === 'back') setCurrent((c) => c.slice(0, -1));
      else if (/^[a-z]$/.test(k)) setCurrent((c) => (c.length < 5 ? c + k : c));
    },
    [over, submit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Enter') press('enter');
      else if (e.key === 'Backspace') press('back');
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const keys = keyboardStates(guesses, answer);
  const rows = [...guesses.map((g) => ({ word: g, marks: evaluate(g, answer) })), ...(over ? [] : [{ word: current, marks: null }])];
  while (rows.length < MAX_GUESSES) rows.push({ word: '', marks: null });
  const s = stats.data;
  const wins = s?.recent.filter((r) => r.detail.won).length ?? 0;

  return (
    <GameFrame
      title="Word guess"
      onRestart={restart}
      rules={
        <>
          <p>Guess the five-letter word in six tries. Type on your keyboard or use the keys below.</p>
          <p>
            <span style={{ color: 'var(--ok)' }}>Green</span>: right letter, right place. <span style={{ color: 'var(--warn)' }}>Amber</span>: in the word, elsewhere. Grey: not in the word.
          </p>
          <p>Guesses must be in the built-in list of {770}+ common words.</p>
        </>
      }
      stats={s ? s.played ? <>Played {s.played} · best {s.best ? `${s.best.score} guesses` : '—'} · {wins} of the last {s.recent.length} solved</> : 'No games yet.' : null}
    >
      <div className="col" style={{ alignItems: 'center', gap: 6 }} role="grid" aria-label="Guesses">
        {rows.map((r, ri) => (
          <div key={ri} className="row" role="row" style={{ gap: 6 }}>
            {Array.from({ length: 5 }, (_, i) => {
              const ch = r.word[i] ?? '';
              const st = r.marks?.[i];
              return (
                <div
                  key={i}
                  role="gridcell"
                  aria-label={ch ? `${ch.toUpperCase()}${st ? `, ${LABEL[st]}` : ''}` : 'empty'}
                  style={{
                    width: 52,
                    height: 52,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 750,
                    textTransform: 'uppercase',
                    borderRadius: 8,
                    border: `2px solid ${st ? 'transparent' : ch ? 'var(--border-strong)' : 'var(--border)'}`,
                    background: st ? COLOR[st] : 'transparent',
                    color: st && st !== 'absent' ? '#0e1016' : 'var(--text)',
                  }}
                >
                  {ch}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="center small" style={{ minHeight: 24, margin: '12px 0' }} role="status" aria-live="polite">
        {message}
      </p>
      <div className="col" style={{ alignItems: 'center', gap: 6 }}>
        {ROWS.map((row, i) => (
          <div key={row} className="row" style={{ gap: 4 }}>
            {i === 2 ? (
              <button type="button" className="btn sm" onClick={() => press('enter')} style={{ height: 44 }}>
                Enter
              </button>
            ) : null}
            {[...row].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                aria-label={`${k.toUpperCase()}${keys[k] ? `, ${LABEL[keys[k]!]}` : ''}`}
                style={{ width: 36, height: 44, borderRadius: 6, border: '1px solid var(--border)', background: keys[k] ? COLOR[keys[k]!] : 'var(--surface-2)', color: keys[k] && keys[k] !== 'absent' ? '#0e1016' : 'var(--text)', fontWeight: 650, cursor: 'pointer', textTransform: 'uppercase' }}
              >
                {k}
              </button>
            ))}
            {i === 2 ? (
              <button type="button" className="btn sm" aria-label="Delete letter" onClick={() => press('back')} style={{ height: 44 }}>
                <Delete size={16} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </GameFrame>
  );
}
