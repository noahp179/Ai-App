/**
 * Achievements.
 *
 * Tiered so they keep giving: each achievement has thresholds, and crossing one
 * unlocks the next tier. `evaluateAchievements` is pure and idempotent — it is
 * safe to call after every session and returns only newly-crossed tiers.
 */

import type { Achievement, UnlockedAchievement } from '../domain/types';

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach-streak',
    title: 'Consistency',
    description: 'Keep a daily streak alive.',
    icon: '🔥',
    tiers: [3, 7, 14, 30, 100, 365],
  },
  {
    id: 'ach-lessons',
    title: 'Scholar',
    description: 'Complete lessons.',
    icon: '📚',
    tiers: [1, 10, 25, 50, 100, 200],
  },
  {
    id: 'ach-xp',
    title: 'Grinder',
    description: 'Earn total XP.',
    icon: '⚡',
    tiers: [100, 1000, 5000, 20000, 50000, 100000],
  },
  {
    id: 'ach-perfect',
    title: 'Flawless',
    description: 'Finish lessons with no mistakes.',
    icon: '💎',
    tiers: [1, 5, 15, 40, 100],
  },
  {
    id: 'ach-tracks',
    title: 'Completionist',
    description: 'Finish entire tracks.',
    icon: '🏆',
    tiers: [1, 3, 5, 10],
  },
  {
    id: 'ach-skills',
    title: 'Polymath',
    description: 'Reach 80% mastery on skills.',
    icon: '🧠',
    tiers: [5, 20, 50, 100],
  },
  {
    id: 'ach-checkpoints',
    title: 'Certified',
    description: 'Pass unit checkpoints.',
    icon: '✅',
    tiers: [1, 5, 15, 30],
  },
  {
    id: 'ach-reviews',
    title: 'Retainer',
    description: 'Complete review sessions.',
    icon: '🔁',
    tiers: [5, 25, 75, 200],
  },
  {
    id: 'ach-early-bird',
    title: 'Early Bird',
    description: 'Finish a lesson before 8am.',
    icon: '🌅',
    tiers: [1, 10, 30],
  },
  {
    id: 'ach-night-owl',
    title: 'Night Owl',
    description: 'Finish a lesson after 11pm.',
    icon: '🦉',
    tiers: [1, 10, 30],
  },
  {
    id: 'ach-domains',
    title: 'Generalist',
    description: 'Practise skills across distinct AI domains.',
    icon: '🌐',
    tiers: [3, 6, 10, 14],
  },
];

export const ACHIEVEMENTS_BY_ID: ReadonlyMap<string, Achievement> = new Map(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

/** Counters the achievement rules read. Maintained by the progress store. */
export interface AchievementStats {
  currentStreak: number;
  lessonsCompleted: number;
  totalXp: number;
  perfectLessons: number;
  tracksCompleted: number;
  skillsMastered: number;
  checkpointsPassed: number;
  reviewSessions: number;
  earlyBirdSessions: number;
  nightOwlSessions: number;
  domainsPractised: number;
}

const STAT_FOR_ACHIEVEMENT: Record<string, keyof AchievementStats> = {
  'ach-streak': 'currentStreak',
  'ach-lessons': 'lessonsCompleted',
  'ach-xp': 'totalXp',
  'ach-perfect': 'perfectLessons',
  'ach-tracks': 'tracksCompleted',
  'ach-skills': 'skillsMastered',
  'ach-checkpoints': 'checkpointsPassed',
  'ach-reviews': 'reviewSessions',
  'ach-early-bird': 'earlyBirdSessions',
  'ach-night-owl': 'nightOwlSessions',
  'ach-domains': 'domainsPractised',
};

/**
 * Returns tiers newly earned since `alreadyUnlocked`.
 *
 * Crossing several tiers at once (a big XP session) returns all of them, so the
 * UI can queue the celebrations rather than dropping any.
 */
export function evaluateAchievements(
  stats: AchievementStats,
  alreadyUnlocked: UnlockedAchievement[],
  now: number = Date.now(),
): UnlockedAchievement[] {
  const highestByAchievement = new Map<string, number>();
  for (const u of alreadyUnlocked) {
    const current = highestByAchievement.get(u.id) ?? 0;
    if (u.tier > current) highestByAchievement.set(u.id, u.tier);
  }

  const newlyUnlocked: UnlockedAchievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    const statKey = STAT_FOR_ACHIEVEMENT[achievement.id];
    if (!statKey) continue;

    const value = stats[statKey];
    const highest = highestByAchievement.get(achievement.id) ?? 0;

    for (const tier of achievement.tiers) {
      if (value >= tier && tier > highest) {
        newlyUnlocked.push({ id: achievement.id, tier, unlockedAt: now });
      }
    }
  }

  return newlyUnlocked;
}

/** Progress toward the next unearned tier, for the achievements screen. */
export interface AchievementProgress {
  achievement: Achievement;
  currentValue: number;
  highestTier: number;
  nextTier: number | null;
  /** 0–1 toward `nextTier`. 1 when every tier is earned. */
  fraction: number;
}

export function achievementProgress(
  stats: AchievementStats,
  unlocked: UnlockedAchievement[],
): AchievementProgress[] {
  const highestByAchievement = new Map<string, number>();
  for (const u of unlocked) {
    const current = highestByAchievement.get(u.id) ?? 0;
    if (u.tier > current) highestByAchievement.set(u.id, u.tier);
  }

  return ACHIEVEMENTS.map((achievement) => {
    const statKey = STAT_FOR_ACHIEVEMENT[achievement.id];
    const currentValue = statKey ? stats[statKey] : 0;
    const highestTier = highestByAchievement.get(achievement.id) ?? 0;
    const nextTier = achievement.tiers.find((t) => t > highestTier) ?? null;

    const previousTier = highestTier;
    const fraction =
      nextTier === null
        ? 1
        : Math.max(
            0,
            Math.min(1, (currentValue - previousTier) / (nextTier - previousTier)),
          );

    return { achievement, currentValue, highestTier, nextTier, fraction };
  });
}
