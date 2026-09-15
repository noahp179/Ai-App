/**
 * Search behaviour.
 *
 * The ranking rules are hand-written, which means they can only be trusted if
 * they are pinned. These tests are mostly about ordering — that the thing a
 * person obviously meant comes first — rather than about whether a match was
 * found at all.
 */

import { describe, expect, it } from 'vitest';

import { SEARCH_SUGGESTIONS, searchCatalog, skillById, tracksForSkill } from '../src/content/search';

describe('search', () => {
  it('finds nothing for a query that is too short', () => {
    expect(searchCatalog('a')).toEqual([]);
    expect(searchCatalog('')).toEqual([]);
  });

  it('puts an exact title match first', () => {
    const results = searchCatalog('Databases');
    expect(results[0]?.kind).toBe('track');
    expect(results[0]?.title).toBe('Databases');
  });

  it('ranks a title prefix above a body mention', () => {
    const results = searchCatalog('quantum');
    expect(results[0]?.title).toContain('Quantum');
  });

  it('finds a lesson by a term defined inside it', () => {
    const results = searchCatalog('race condition');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.kind === 'lesson' || r.kind === 'skill')).toBe(true);
  });

  it('requires every term of a multi-word query to appear somewhere', () => {
    // A nonsense pairing of two words that each exist in the catalog.
    const results = searchCatalog('quantum tokenization zzzzz');
    expect(results).toEqual([]);
  });

  it('returns a snippet when the match was in the body rather than the title', () => {
    const results = searchCatalog('thrashing');
    const bodyMatch = results.find((r) => r.snippet !== undefined);
    expect(bodyMatch?.snippet).toBeTruthy();
  });

  it('respects the result limit', () => {
    expect(searchCatalog('the', 5).length).toBeLessThanOrEqual(5);
  });

  it('is case and whitespace insensitive', () => {
    const a = searchCatalog('BIG-O');
    const b = searchCatalog('  big-o  ');
    expect(a[0]?.id).toBe(b[0]?.id);
  });

  it('surfaces results across every kind', () => {
    const kinds = new Set<string>();
    for (const query of ['machine learning', 'entropy', 'engineer', 'binary search']) {
      for (const result of searchCatalog(query)) kinds.add(result.kind);
    }
    expect(kinds.has('track')).toBe(true);
    expect(kinds.has('lesson')).toBe(true);
    expect(kinds.has('skill')).toBe(true);
    expect(kinds.has('path')).toBe(true);
  });

  it('every suggestion returns at least one result', () => {
    const empty = SEARCH_SUGGESTIONS.filter((s) => searchCatalog(s).length === 0);
    expect(empty).toEqual([]);
  });
});

describe('skill lookups', () => {
  it('resolves a skill by id', () => {
    expect(skillById('sk-big-o')?.name).toBeTruthy();
    expect(skillById('sk-not-real')).toBeUndefined();
  });

  it('finds the tracks that practise a skill', () => {
    const tracks = tracksForSkill('sk-big-o');
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks.every((t) => t.id.startsWith('track-'))).toBe(true);
  });

  it('returns no tracks for an unknown skill', () => {
    expect(tracksForSkill('sk-not-real')).toEqual([]);
  });
});
