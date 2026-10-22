import { RotateCcw, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import type { GameId } from '../../../shared/types';
import { Button } from '../../components/ui';
import { api } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';

export function useGameStats(game: GameId, filter?: { key: string; value: string }) {
  return useQuery(`games:${game}:${filter?.key ?? ''}:${filter?.value ?? ''}`, () => api.games.stats(game, filter));
}

export async function recordScore(game: GameId, score: number, detail: Record<string, string | number | boolean> = {}) {
  await api.games.record(game, score, detail);
  invalidate('games');
}

export function GameFrame({ title, rules, stats, onRestart, children }: { title: string; rules: ReactNode; stats?: ReactNode; onRestart: () => void; children: ReactNode }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(320px, 1fr) minmax(220px, 300px)', alignItems: 'start' }}>
      <div className="card" style={{ padding: 20 }}>
        {children}
      </div>
      <div className="stack-4">
        <div className="card stack-3">
          <div className="row">
            <h3 className="grow">{title}</h3>
            <Button size="sm" icon={<RotateCcw size={13} />} onClick={onRestart}>
              New game
            </Button>
          </div>
          <div className="small muted stack-3">{rules}</div>
        </div>
        {stats ? (
          <div className="card stack-3">
            <div className="row">
              <Trophy size={15} color="var(--warn)" />
              <h3>Your scores</h3>
            </div>
            <div className="small">{stats}</div>
            <p className="tiny faint">Stored on this computer.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
