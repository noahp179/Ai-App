import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { mulberry32, randomSeed } from '../../../shared/games/rng';
import { type TriviaRound, newTriviaRound } from '../../../shared/games/trivia';
import { Button, ProgressBar } from '../../components/ui';
import { GameFrame, recordScore, useGameStats } from './common';

const ROUND = 10;

export function Trivia() {
  const [round, setRound] = useState<TriviaRound>(() => newTriviaRound(ROUND, mulberry32(randomSeed())));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const stats = useGameStats('trivia');
  const q = round.questions[idx]!;

  const restart = () => {
    setRound(newTriviaRound(ROUND, mulberry32(randomSeed())));
    setIdx(0);
    setPicked(null);
    setCorrect(0);
    setFinished(false);
  };
  const choose = (i: number) => {
    if (picked !== null || finished) return;
    setPicked(i);
    if (i === q.answer) setCorrect((c) => c + 1);
  };
  const next = () => {
    if (picked === null) return;
    if (idx + 1 >= round.questions.length) {
      setFinished(true);
      void recordScore('trivia', correct, { of: round.questions.length, won: true });
      return;
    }
    setIdx(idx + 1);
    setPicked(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-4]$/.test(e.key)) choose(Number(e.key) - 1);
      else if (e.key === 'Enter' && picked !== null && !(t?.tagName === 'BUTTON')) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <GameFrame
      title="AI & computing trivia"
      onRestart={restart}
      rules={
        <>
          <p>Ten multiple-choice questions about AI history, machine-learning ideas and computing. Each answer comes with a short explanation.</p>
          <p>Press 1–4 to answer and Enter for the next question.</p>
        </>
      }
      stats={stats.data ? <>Played {stats.data.played} · best {stats.data.best ? `${stats.data.best.score}/${ROUND}` : '—'}</> : null}
    >
      {finished ? (
        <div className="stack-4 center" role="status">
          <h2>
            {correct} / {round.questions.length} correct
          </h2>
          <p className="muted">{correct >= 8 ? 'Excellent!' : correct >= 5 ? 'Nicely done.' : 'Every round teaches something — try another.'}</p>
          <div>
            <Button variant="primary" onClick={restart}>
              Play another round
            </Button>
          </div>
        </div>
      ) : (
        <div className="stack-4">
          <ProgressBar value={idx / round.questions.length} label={`Question ${idx + 1} of ${round.questions.length}`} />
          <div className="row small muted">
            <span className="grow">
              Question {idx + 1} of {round.questions.length}
            </span>
            <span>Score {correct}</span>
          </div>
          <h2 style={{ fontSize: '1.2rem' }}>{q.q}</h2>
          <div className="col" style={{ gap: 8 }} role="group" aria-label="Answers">
            {q.options.map((o, i) => {
              const isAnswer = picked !== null && i === q.answer;
              const isWrongPick = picked === i && i !== q.answer;
              return (
                <button
                  key={o}
                  type="button"
                  className="list-item"
                  onClick={() => choose(i)}
                  disabled={picked !== null}
                  aria-label={`${i + 1}. ${o}${isAnswer ? ' — correct answer' : isWrongPick ? ' — your answer, incorrect' : ''}`}
                  style={{
                    padding: '10px 12px',
                    border: `1px solid ${isAnswer ? 'var(--ok)' : isWrongPick ? 'var(--danger)' : 'var(--border)'}`,
                    background: isAnswer ? 'var(--ok-bg)' : isWrongPick ? 'var(--danger-bg)' : 'var(--surface)',
                    opacity: 1,
                  }}
                >
                  <span className="mono faint" style={{ width: 18 }}>
                    {i + 1}
                  </span>
                  <span className="grow">{o}</span>
                  {isAnswer ? <Check size={16} color="var(--ok)" aria-hidden /> : null}
                  {isWrongPick ? <X size={16} color="var(--danger)" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
          {picked !== null ? (
            <div className="stack-3" aria-live="polite">
              <p className={picked === q.answer ? 'ok-text' : 'danger-text'} style={{ fontWeight: 600 }}>
                {picked === q.answer ? 'Correct!' : `Not quite — the answer is “${q.options[q.answer]}”.`}
              </p>
              <p className="small muted">{q.explain}</p>
              <div>
                <Button variant="primary" onClick={next} autoFocus>
                  {idx + 1 >= round.questions.length ? 'See results' : 'Next question'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </GameFrame>
  );
}
