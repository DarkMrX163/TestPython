import type { Difficulty, TopicId, UserProgress } from '../types';

const STORAGE_KEY = 'pyterm_python_quiz_progress_v1';

export function createInitialProgress(): UserProgress {
  return {
    xp: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    bestStreak: 0,
    currentStreak: 0,
    answeredQuestionIds: [],
    correctQuestionIds: [],
    completedModes: [],
    topicStats: {
      variables: { answered: 0, correct: 0 },
      strings: { answered: 0, correct: 0 },
      conditions: { answered: 0, correct: 0 },
      loops: { answered: 0, correct: 0 },
      collections: { answered: 0, correct: 0 },
      functions: { answered: 0, correct: 0 },
    },
    difficultyStats: {
      beginner: { answered: 0, correct: 0 },
      intermediate: { answered: 0, correct: 0 },
      advanced: { answered: 0, correct: 0 },
    },
    sessions: [],
    unlockedAchievements: [],
    githubSync: {
      lastSyncedAt: null,
      gistId: null,
      gistUrl: null,
      syncCount: 0,
    },
  };
}

export function normalizeProgress(raw: unknown): UserProgress {
  const base = createInitialProgress();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<UserProgress>;

  const topicStats = { ...base.topicStats };
  if (r.topicStats && typeof r.topicStats === 'object') {
    for (const key of Object.keys(base.topicStats) as TopicId[]) {
      const entry = r.topicStats[key];
      if (entry && typeof entry.answered === 'number' && typeof entry.correct === 'number') {
        topicStats[key] = { answered: entry.answered, correct: entry.correct };
      }
    }
  }

  const difficultyStats = { ...base.difficultyStats };
  if (r.difficultyStats && typeof r.difficultyStats === 'object') {
    for (const key of Object.keys(base.difficultyStats) as Difficulty[]) {
      const entry = r.difficultyStats[key];
      if (entry && typeof entry.answered === 'number' && typeof entry.correct === 'number') {
        difficultyStats[key] = { answered: entry.answered, correct: entry.correct };
      }
    }
  }

  return {
    xp: typeof r.xp === 'number' ? r.xp : base.xp,
    totalAnswered: typeof r.totalAnswered === 'number' ? r.totalAnswered : base.totalAnswered,
    totalCorrect: typeof r.totalCorrect === 'number' ? r.totalCorrect : base.totalCorrect,
    bestStreak: typeof r.bestStreak === 'number' ? r.bestStreak : base.bestStreak,
    currentStreak: typeof r.currentStreak === 'number' ? r.currentStreak : base.currentStreak,
    answeredQuestionIds: Array.isArray(r.answeredQuestionIds) ? r.answeredQuestionIds : [],
    correctQuestionIds: Array.isArray(r.correctQuestionIds) ? r.correctQuestionIds : [],
    completedModes: Array.isArray(r.completedModes) ? r.completedModes : [],
    topicStats,
    difficultyStats,
    sessions: Array.isArray(r.sessions) ? r.sessions : [],
    unlockedAchievements: Array.isArray(r.unlockedAchievements) ? r.unlockedAchievements : [],
    githubSync: {
      lastSyncedAt: r.githubSync?.lastSyncedAt ?? null,
      gistId: r.githubSync?.gistId ?? null,
      gistUrl: r.githubSync?.gistUrl ?? null,
      syncCount: typeof r.githubSync?.syncCount === 'number' ? r.githubSync.syncCount : 0,
    },
  };
}

export function loadProgress(): UserProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialProgress();
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return createInitialProgress();
  }
}

export function saveProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors gracefully
  }
}
