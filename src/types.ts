export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type QuizMode = Difficulty | 'mixed';

export type TopicId =
  | 'variables'
  | 'strings'
  | 'conditions'
  | 'loops'
  | 'collections'
  | 'functions';

export interface Question {
  id: string;
  difficulty: Difficulty;
  topic: TopicId;
  prompt: string;
  code?: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  tip: string;
  hint: string;
  terminalOutput: string;
  xp: number;
}

export interface TopicStat {
  answered: number;
  correct: number;
}

export interface QuizSessionRecord {
  id: string;
  mode: QuizMode;
  date: string;
  score: number;
  total: number;
  accuracy: number;
  xpEarned: number;
  durationSec: number;
  bestStreak: number;
}

export interface GitHubSyncMeta {
  lastSyncedAt: string | null;
  gistId: string | null;
  gistUrl: string | null;
  syncCount: number;
}

export interface UserProgress {
  xp: number;
  totalAnswered: number;
  totalCorrect: number;
  bestStreak: number;
  currentStreak: number;
  answeredQuestionIds: string[];
  correctQuestionIds: string[];
  completedModes: QuizMode[];
  topicStats: Record<TopicId, TopicStat>;
  difficultyStats: Record<Difficulty, TopicStat>;
  sessions: QuizSessionRecord[];
  unlockedAchievements: string[];
  githubSync: GitHubSyncMeta;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  asciiArt: string;
  requirementLabel: string;
  check: (progress: UserProgress) => boolean;
}

export interface DeveloperRank {
  level: number;
  title: string;
  minXp: number;
  nextXp: number | null;
  promptSymbol: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export interface GitHubConfig {
  configured: boolean;
  callbackUrl: string;
}

export interface SavedGistItem {
  id: string;
  url: string;
  description: string;
  updatedAt: string;
  isPublic: boolean;
}

export type ActiveTab = 'quiz' | 'progress' | 'achievements' | 'github';
