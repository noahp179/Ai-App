import type { GameId, GameScore, GameStats } from '../shared/types';
import type { Db } from './db/database';
import { json } from './db/database';
import { type Clock, UserError, newId } from './util';

const GAMES: GameId[] = ['wordguess', 'sudoku', 'memory', 'reaction', 'trivia'];
/** Higher is better only for trivia (correct answers); the rest count guesses, seconds, moves or milliseconds. */
const HIGHER_IS_BETTER: Record<GameId, boolean> = { wordguess: false, sudoku: false, memory: false, reaction: false, trivia: true };

interface Row {
  id: string;
  game: GameId;
  score: number;
  detail: string;
  played_at: string;
}
const toScore = (r: Row): GameScore => ({ id: r.id, game: r.game, score: r.score, detail: json(r.detail, {}), playedAt: r.played_at });

export class GamesService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  private check(game: unknown): GameId {
    if (!GAMES.includes(game as GameId)) throw new UserError('Unknown game.');
    return game as GameId;
  }

  record(game: GameId, score: number, detail: Record<string, string | number | boolean> = {}): GameScore {
    this.check(game);
    if (!Number.isFinite(score) || score < 0 || score > 1e7) throw new UserError('Invalid score.');
    const id = newId();
    const safe = Object.fromEntries(Object.entries(detail ?? {}).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v)).slice(0, 10));
    this.db.run('INSERT INTO game_scores (id, game, score, detail, played_at) VALUES (?, ?, ?, ?, ?)', [id, game, score, JSON.stringify(safe), this.clock.now().toISOString()]);
    return toScore(this.db.get<Row>('SELECT * FROM game_scores WHERE id = ?', [id])!);
  }

  /** Stats for one game. "Best" only counts wins/completions (detail.won !== false). */
  stats(game: GameId, filter?: { key: string; value: string }): GameStats {
    this.check(game);
    const rows = this.db.all<Row>('SELECT * FROM game_scores WHERE game = ? ORDER BY played_at DESC', [game]).map(toScore);
    const relevant = filter ? rows.filter((r) => String(r.detail[filter.key]) === filter.value) : rows;
    const wins = relevant.filter((r) => r.detail.won !== false);
    const best = wins.reduce<GameScore | null>((b, r) => (!b ? r : HIGHER_IS_BETTER[game] ? (r.score > b.score ? r : b) : r.score < b.score ? r : b), null);
    return { game, played: relevant.length, best, recent: relevant.slice(0, 10) };
  }

  all(): GameStats[] {
    return GAMES.map((g) => this.stats(g));
  }

  saveState(game: GameId, state: unknown): void {
    this.check(game);
    const s = JSON.stringify(state);
    if (s.length > 100_000) throw new UserError('Game state too large.');
    this.db.run(
      `INSERT INTO game_state (game, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(game) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
      [game, s, this.clock.now().toISOString()],
    );
  }

  loadState<T>(game: GameId): T | null {
    this.check(game);
    return json<T | null>(this.db.get<{ state: string }>('SELECT state FROM game_state WHERE game = ?', [game])?.state, null);
  }

  clearState(game: GameId): void {
    this.db.run('DELETE FROM game_state WHERE game = ?', [game]);
  }

  resetScores(game?: GameId): void {
    if (game) this.db.run('DELETE FROM game_scores WHERE game = ?', [this.check(game)]);
    else this.db.run('DELETE FROM game_scores');
  }
}
