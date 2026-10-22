import { ArrowLeft, Brain, Grid3x3, HelpCircle, Timer, Type } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import type { GameId, GameStats } from '../../../shared/types';
import { Button, useConfirm } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDuration, fmtRelative } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { Memory } from './Memory';
import { Reaction } from './Reaction';
import { Sudoku } from './Sudoku';
import { Trivia } from './Trivia';
import { WordGuess } from './WordGuess';

interface GameInfo {
  id: GameId;
  name: string;
  blurb: string;
  icon: ReactNode;
  component: ComponentType;
  best: (s: GameStats) => string;
}

export const GAMES: GameInfo[] = [
  { id: 'wordguess', name: 'Word guess', blurb: 'Find the hidden five-letter word in six tries.', icon: <Type size={20} />, component: WordGuess, best: (s) => `${s.best!.score} guesses` },
  { id: 'sudoku', name: 'Sudoku', blurb: 'Classic 9×9 logic puzzle in three difficulties.', icon: <Grid3x3 size={20} />, component: Sudoku, best: (s) => fmtDuration(s.best!.score * 1000) },
  { id: 'memory', name: 'Memory match', blurb: 'Flip cards and find the pairs.', icon: <Brain size={20} />, component: Memory, best: (s) => `${s.best!.score} moves` },
  { id: 'trivia', name: 'AI trivia', blurb: 'Ten questions on AI and computing, with explanations.', icon: <HelpCircle size={20} />, component: Trivia, best: (s) => `${s.best!.score}/10` },
  { id: 'reaction', name: 'Reaction time', blurb: 'Click as soon as the panel turns green.', icon: <Timer size={20} />, component: Reaction, best: (s) => `${s.best!.score} ms` },
];

function Hub() {
  const confirm = useConfirm();
  const all = useQuery('games:all', () => api.games.all());
  const byId = new Map(all.data?.map((s) => [s.game, s]));
  return (
    <div className="page stack-5">
      <div className="row">
        <div className="grow">
          <h1>Games</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Short, offline games for a break. Scores stay on this computer. You can hide this section in Settings → Modules.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            if (!(await confirm({ title: 'Reset all game scores?', message: 'Every saved score and personal best will be deleted.', confirmLabel: 'Reset', danger: true }))) return;
            await api.games.resetScores();
            invalidate('games');
          }}
        >
          Reset scores
        </Button>
      </div>
      <div className="grid grid-3">
        {GAMES.map((g) => {
          const s = byId.get(g.id);
          return (
            <button key={g.id} type="button" className="card stack-3" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate(`/games/${g.id}`)}>
              <div className="row">
                <span style={{ color: 'var(--accent)' }}>{g.icon}</span>
                <h3 className="grow">{g.name}</h3>
              </div>
              <p className="small muted">{g.blurb}</p>
              <p className="tiny faint">
                {s && s.played ? (
                  <>
                    Played {s.played} · best {s.best ? g.best(s) : '—'} · last {fmtRelative(s.recent[0]!.playedAt)}
                  </>
                ) : (
                  'Not played yet'
                )}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Games() {
  const route = useRoute();
  const game = GAMES.find((g) => g.id === route.segments[1]);
  if (!game) return <Hub />;
  const C = game.component;
  return (
    <div className="page stack-4" style={{ maxWidth: 1100 }}>
      <div className="row">
        <Button size="sm" variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => navigate('/games')}>
          All games
        </Button>
        <h1 style={{ fontSize: '1.3rem' }}>{game.name}</h1>
      </div>
      <C />
    </div>
  );
}
