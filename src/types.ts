export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type QuizMode = Difficulty | 'mixed' | 'adaptive' | 'mistakes';

export type QuestionKind = 'choice' | 'fill-blank' | 'find-bug';

export type TopicId =
  | 'variables'
  | 'strings'
  | 'conditions'
  | 'loops'
  | 'collections'
  | 'functions';

export interface TraceVariable {
  name: string;
  value: string;
  type: string;
  changed?: boolean;
}

export interface TraceStep {
  line: number; // 1-indexed line in code
  note: string;
  variables: TraceVariable[];
  output?: string;
}

export interface Question {
  id: string;
  kind: QuestionKind;
  difficulty: Difficulty;
  topic: TopicId;
  prompt: string;
  code?: string;
  // For 'choice' and 'fill-blank' (quick chip options in fill-blank)
  options?: [string, string, string, string];
  correctIndex?: number;
  // For 'fill-blank': exact accepted answers (trimmed) and placeholder token '___' inside code
  acceptedAnswers?: string[];
  blankPlaceholder?: string;
  // For 'find-bug': 1-indexed line number containing the bug and fixed line preview
  buggyLine?: number;
  fixedLine?: string;
  explanation: string;
  tip: string;
  hint: string;
  terminalOutput: string;
  trace?: TraceStep[];
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
  wrongQuestionIds: string[];
  mistakesFixedCount: number;
  bugFixedCount: number;
  fillBlankCorrectCount: number;
  completedModes: QuizMode[];
  activityByDate: Record<string, number>; // YYYY-MM-DD -> answered count
  topicStats: Record<TopicId, TopicStat>;
  difficultyStats: Record<Difficulty, TopicStat>;
  sessions: QuizSessionRecord[];
  unlockedAchievements: string[];
  githubSync: GitHubSyncMeta;
  soundEnabled: boolean;
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
