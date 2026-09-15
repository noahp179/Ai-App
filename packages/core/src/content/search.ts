/**
 * Catalog search.
 *
 * Forty tracks, 200-odd lessons and 400 skills is past the point where
 * browsing finds things. This builds a flat index once and scores matches with
 * a small hand-written ranker rather than pulling in a search library — the
 * corpus is a few thousand short strings that all fit in memory, and the
 * ranking rules that matter here are domain-specific enough that a generic
 * relevance model would need as much tuning as this does.
 *
 * The ranking priorities, in order:
 *   1. An exact title match beats everything.
 *   2. A title prefix beats a title substring beats a body substring.
 *   3. Shorter titles win ties, because a match in "Loops" is more likely to
 *      be what you meant than the same match inside a long lesson title.
 *   4. Tracks and paths outrank lessons, which outrank skills — you can get to
 *      a lesson from a track, but not the reverse.
 */

import type { Lesson, Skill, Track } from '../domain/types';

import { TRACKS } from './index';
import { PATHS } from './paths';
import { SKILLS } from './skills';

export type SearchKind = 'track' | 'path' | 'lesson' | 'skill';

export interface SearchResult {
  kind: SearchKind;
  /** Route target: a track id, path id, lesson id or skill id. */
  id: string;
  title: string;
  /** One line of context — the tagline, the parent track, the domain. */
  subtitle: string;
  /** Why this matched, for highlighting. Empty when the title matched. */
  snippet?: string;
  score: number;
}

interface IndexEntry {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  /** Lower-cased haystack of everything else worth matching. */
  body: string;
}

/** Base weight per kind, so a track outranks a lesson at equal text quality. */
const KIND_WEIGHT: Record<SearchKind, number> = {
  track: 30,
  path: 28,
  lesson: 20,
  skill: 10,
};

const normalize = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ');

/**
 * Builds the index once, lazily.
 *
 * Module-level rather than per-call because the catalog is immutable at
 * runtime, and rebuilding a few thousand strings on every keystroke would be
 * visible on a mid-range phone.
 */
let cachedIndex: IndexEntry[] | null = null;

function buildIndex(): IndexEntry[] {
  if (cachedIndex) return cachedIndex;

  const entries: IndexEntry[] = [];

  for (const track of TRACKS) {
    entries.push({
      kind: 'track',
      id: track.id,
      title: track.title,
      subtitle: track.tagline,
      body: normalize(
        [track.tagline, track.description, ...track.outcomes, track.domain].join(' '),
      ),
    });

    for (const unit of track.units) {
      for (const lesson of unit.lessons) {
        entries.push({
          kind: 'lesson',
          id: lesson.id,
          title: lesson.title,
          subtitle: track.title,
          body: normalize([lesson.summary, unit.title, conceptText(lesson)].join(' ')),
        });
      }
    }
  }

  for (const path of PATHS) {
    entries.push({
      kind: 'path',
      id: path.id,
      title: path.title,
      subtitle: path.tagline,
      body: normalize([path.tagline, path.description, path.audience, ...path.outcomes].join(' ')),
    });
  }

  for (const skill of SKILLS) {
    entries.push({
      kind: 'skill',
      id: skill.id,
      title: skill.name,
      subtitle: skill.domain,
      body: normalize([skill.name, skill.domain, skill.level].join(' ')),
    });
  }

  cachedIndex = entries;
  return entries;
}

/**
 * The searchable text of a lesson's concept screens.
 *
 * Key terms are included because they are the vocabulary someone is most
 * likely to search for — "what was a race condition again" should find the
 * lesson that defines it, not only lessons with it in the title.
 */
function conceptText(lesson: Lesson): string {
  const parts: string[] = [];
  for (const step of lesson.steps) {
    if (step.type !== 'concept') continue;
    parts.push(step.title);
    for (const term of step.keyTerms ?? []) {
      parts.push(term.term, term.definition);
    }
  }
  return parts.join(' ');
}

/** Extracts a short window of `body` around the match, for display. */
function snippetAround(body: string, query: string): string | undefined {
  const at = body.indexOf(query);
  if (at < 0) return undefined;
  const start = Math.max(0, at - 30);
  const end = Math.min(body.length, at + query.length + 50);
  return `${start > 0 ? '…' : ''}${body.slice(start, end).trim()}${end < body.length ? '…' : ''}`;
}

/**
 * Searches tracks, paths, lessons and skills.
 *
 * Returns an empty array for a query under two characters — a one-letter
 * query matches most of the catalog, which is worse than showing nothing.
 */
export function searchCatalog(rawQuery: string, limit = 24): SearchResult[] {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];

  const terms = query.split(' ').filter(Boolean);
  const results: SearchResult[] = [];

  for (const entry of buildIndex()) {
    const title = normalize(entry.title);

    let score = 0;
    let snippet: string | undefined;

    if (title === query) {
      score = 1000;
    } else if (title.startsWith(query)) {
      score = 500;
    } else if (title.includes(query)) {
      score = 300;
    } else if (entry.body.includes(query)) {
      score = 120;
      snippet = snippetAround(entry.body, query);
    } else if (terms.length > 1) {
      // Every term must appear somewhere, so "cache miss" does not match a
      // lesson that says "cache" and a different one that says "miss".
      const haystack = `${title} ${entry.body}`;
      const hits = terms.filter((t) => haystack.includes(t)).length;
      if (hits === terms.length) {
        score = 60;
        snippet = snippetAround(entry.body, terms[0] ?? '');
      }
    }

    if (score === 0) continue;

    // Shorter titles win ties: a match in "Loops" is more likely to be what
    // was meant than the same match inside a long lesson title.
    score += KIND_WEIGHT[entry.kind] - Math.min(20, title.length / 4);

    results.push({
      kind: entry.kind,
      id: entry.id,
      title: entry.title,
      subtitle: entry.subtitle,
      ...(snippet ? { snippet } : {}),
      score,
    });
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

/**
 * A few suggestions for the empty state.
 *
 * Deliberately spread across domains and difficulty so the blank search screen
 * doubles as a hint about how wide the catalog is.
 */
export const SEARCH_SUGGESTIONS: readonly string[] = [
  'attention',
  'big-o',
  'deadlock',
  'entropy',
  'gradient descent',
  'index',
  'overfitting',
  'p-value',
  'race condition',
  'tokenization',
];

/** The tracks a skill is practised in, for a skill result's detail line. */
export function tracksForSkill(skillId: string): Track[] {
  const out: Track[] = [];
  for (const track of TRACKS) {
    const found = track.units.some((unit) => {
      const inLessons = unit.lessons.some((lesson) =>
        lesson.steps.some(
          (step) => step.type === 'exercise' && step.exercise.skillIds.includes(skillId),
        ),
      );
      const inCheckpoint = (unit.checkpoint?.exercises ?? []).some((exercise) =>
        exercise.skillIds.includes(skillId),
      );
      return inLessons || inCheckpoint;
    });
    if (found) out.push(track);
  }
  return out;
}

/** Looks a skill up by id, for rendering a search result. */
export function skillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}
