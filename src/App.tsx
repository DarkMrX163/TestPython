import { Github, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AchievementsView } from './components/AchievementsView';
import { CertificateView } from './components/CertificateView';
import { GitHubSyncView } from './components/GitHubSyncView';
import { ProgressDashboard } from './components/ProgressDashboard';
import { QuizArena, type QuizCompletionPayload } from './components/QuizArena';
import { evaluateAchievements, generateMarkdownReport } from './data/achievements';
import type {
  AchievementDef,
  ActiveTab,
  GitHubConfig,
  GitHubUser,
  QuizMode,
  SavedGistItem,
  StudentProfile,
  UserProgress,
} from './types';
import { playAchievementSound } from './utils/sound';
import {
  createInitialProgress,
  generateCertificateId,
  getCertificateEligibility,
  getLocalDateKey,
  loadProgress,
  normalizeProgress,
  saveProgress,
} from './utils/storage';

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'quiz', label: 'Викторина' },
  { id: 'progress', label: 'Прогресс' },
  { id: 'achievements', label: 'Достижения' },
  { id: 'certificate', label: 'Сертификат' },
  { id: 'github', label: 'GitHub' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('quiz');
  const [requestedMode, setRequestedMode] = useState<QuizMode | null>(null);
  const [progress, setProgress] = useState<UserProgress>(() => loadProgress());
  const [toastAchievement, setToastAchievement] = useState<AchievementDef | null>(null);

  // GitHub integration state
  const [githubConfig, setGithubConfig] = useState<GitHubConfig | null>(null);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [savedGists, setSavedGists] = useState<SavedGistItem[]>([]);
  const [loadingGists, setLoadingGists] = useState(false);
  const [syncingGitHub, setSyncingGitHub] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [ghStatus, setGhStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Persist progress whenever it updates
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Automatically issue certificate metadata if progress already meets criteria
  useEffect(() => {
    const eligibility = getCertificateEligibility(progress);
    if (eligibility.courseCompleted && (!progress.certificateIssuedAt || !progress.certificateId)) {
      setProgress((prev) => ({
        ...prev,
        certificateIssuedAt: prev.certificateIssuedAt || new Date().toISOString(),
        certificateId: prev.certificateId || generateCertificateId(),
      }));
    }
  }, [progress]);

  const fetchSavedGists = useCallback(async () => {
    setLoadingGists(true);
    try {
      const res = await fetch('/api/github/gists', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { gists?: SavedGistItem[] };
        setSavedGists(Array.isArray(data.gists) ? data.gists : []);
      }
    } catch {
      // Network error handled silently on background load
    } finally {
      setLoadingGists(false);
    }
  }, []);

  const fetchGitHubSession = useCallback(async () => {
    try {
      const [cfgRes, meRes] = await Promise.all([
        fetch('/api/github/config', { credentials: 'include' }),
        fetch('/api/github/me', { credentials: 'include' }),
      ]);

      if (cfgRes.ok) {
        const cfg = (await cfgRes.json()) as GitHubConfig;
        setGithubConfig(cfg);
      }
      if (meRes.ok) {
        const me = (await meRes.json()) as { connected: boolean; user: GitHubUser | null };
        setGithubUser(me.connected ? me.user : null);
        if (me.connected) {
          void fetchSavedGists();
        }
      }
    } catch {
      // Static hosting (e.g. GitHub Pages) or server restarting
    }
  }, [fetchSavedGists]);

  useEffect(() => {
    void fetchGitHubSession();
  }, [fetchGitHubSession]);

  // Listen for OAuth popup postMessage callback
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setGhStatus({
          type: 'success',
          text: event.data.user?.login
            ? `GitHub подключён: @${event.data.user.login}`
            : 'Аккаунт GitHub успешно подключён.',
        });
        void fetchGitHubSession();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setGhStatus({
          type: 'error',
          text: event.data.error || 'Не удалось выполнить вход через GitHub.',
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchGitHubSession]);

  // Auto-hide achievement toast
  useEffect(() => {
    if (!toastAchievement) return;
    const id = window.setTimeout(() => setToastAchievement(null), 4800);
    return () => window.clearTimeout(id);
  }, [toastAchievement]);

  const handleToggleSound = useCallback(() => {
    setProgress((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  }, []);

  const handleUpdateProfile = useCallback((studentProfile: StudentProfile) => {
    setProgress((prev) => ({ ...prev, studentProfile }));
  }, []);

  const handleConnectGitHub = useCallback(async () => {
    setGhStatus(null);
    if (!githubConfig?.configured) {
      setActiveTab('github');
      return;
    }

    try {
      const res = await fetch('/api/auth/github/url', { credentials: 'include' });
      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        setGhStatus({
          type: 'error',
          text: data.error || 'Не удалось получить ссылку авторизации GitHub.',
        });
        setActiveTab('github');
        return;
      }

      const authWindow = window.open(data.url, 'github_oauth_popup', 'width=620,height=720');
      if (!authWindow) {
        setGhStatus({
          type: 'error',
          text: 'Браузер заблокировал всплывающее окно. Разрешите pop-up окна для входа в GitHub.',
        });
        setActiveTab('github');
      }
    } catch {
      setGhStatus({
        type: 'error',
        text: 'Ошибка сети при подключении к GitHub.',
      });
      setActiveTab('github');
    }
  }, [githubConfig]);

  const handleDisconnectGitHub = useCallback(async () => {
    try {
      await fetch('/api/github/disconnect', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Continue clearing local UI state
    }
    setGithubUser(null);
    setSavedGists([]);
    setGhStatus({ type: 'success', text: 'Аккаунт GitHub отключён.' });
  }, []);

  const handleSaveToGitHub = useCallback(
    async (isPublic = false, createNew = false) => {
      if (!githubUser) {
        setActiveTab('github');
        return;
      }

      setSyncingGitHub(true);
      setGhStatus(null);

      try {
        const nextSyncCount = progress.githubSync.syncCount + 1;
        const previewProgress: UserProgress = {
          ...progress,
          githubSync: {
            ...progress.githubSync,
            syncCount: nextSyncCount,
          },
        };
        const { newlyUnlocked, updatedProgress } = evaluateAchievements(previewProgress);
        const markdownReport = generateMarkdownReport(updatedProgress, githubUser.login);

        const res = await fetch('/api/github/save-results', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            progress: updatedProgress,
            markdownReport,
            gistId: createNew ? null : progress.githubSync.gistId,
            isPublic,
          }),
        });

        const data = (await res.json()) as {
          gistId?: string;
          gistUrl?: string;
          updatedAt?: string;
          error?: string;
        };

        if (!res.ok || !data.gistId || !data.gistUrl) {
          setGhStatus({
            type: 'error',
            text: data.error || 'Не удалось сохранить результаты в GitHub Gist.',
          });
          return;
        }

        const finalProgress: UserProgress = {
          ...updatedProgress,
          githubSync: {
            lastSyncedAt: data.updatedAt || new Date().toISOString(),
            gistId: data.gistId,
            gistUrl: data.gistUrl,
            syncCount: nextSyncCount,
          },
        };

        setProgress(finalProgress);
        if (newlyUnlocked.length > 0) {
          setToastAchievement(newlyUnlocked[0]);
          if (finalProgress.soundEnabled) playAchievementSound();
        }
        setGhStatus({
          type: 'success',
          text: 'Результаты успешно сохранены в GitHub Gist!',
        });
        void fetchSavedGists();
      } catch {
        setGhStatus({
          type: 'error',
          text: 'Сетевая ошибка при сохранении в GitHub.',
        });
      } finally {
        setSyncingGitHub(false);
      }
    },
    [githubUser, progress, fetchSavedGists]
  );

  const handleRestoreGist = useCallback(async (gistId: string) => {
    setRestoringId(gistId);
    setGhStatus(null);
    try {
      const res = await fetch(`/api/github/gists/${encodeURIComponent(gistId)}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as {
        gistId?: string;
        gistUrl?: string;
        updatedAt?: string;
        progress?: unknown;
        error?: string;
      };

      if (!res.ok || !data.progress) {
        setGhStatus({
          type: 'error',
          text: data.error || 'Не удалось восстановить данные из Gist.',
        });
        return;
      }

      const normalized = normalizeProgress(data.progress);
      normalized.githubSync = {
        ...normalized.githubSync,
        gistId: data.gistId ?? gistId,
        gistUrl: data.gistUrl ?? normalized.githubSync.gistUrl,
        lastSyncedAt: data.updatedAt ?? normalized.githubSync.lastSyncedAt,
      };
      setProgress(normalized);
      setGhStatus({
        type: 'success',
        text: 'Прогресс успешно восстановлен из GitHub Gist!',
      });
    } catch {
      setGhStatus({
        type: 'error',
        text: 'Ошибка при загрузке снимка с GitHub.',
      });
    } finally {
      setRestoringId(null);
    }
  }, []);

  const handleCompleteSession = useCallback(
    (payload: QuizCompletionPayload): AchievementDef[] => {
      const nextTopicStats = { ...progress.topicStats };
      const nextDiffStats = { ...progress.difficultyStats };
      const answeredSet = new Set(progress.answeredQuestionIds);
      const correctSet = new Set(progress.correctQuestionIds);
      const wrongSet = new Set(progress.wrongQuestionIds);

      let runningStreak = progress.currentStreak;
      let maxStreak = Math.max(progress.bestStreak, payload.bestStreak);
      let correctInSession = 0;
      let mistakesFixed = progress.mistakesFixedCount;
      let bugFixed = progress.bugFixedCount;
      let fillBlankCorrect = progress.fillBlankCorrectCount;

      for (const item of payload.answers) {
        const { topic, difficulty, id, kind } = item.question;
        answeredSet.add(id);

        nextTopicStats[topic] = {
          answered: (nextTopicStats[topic]?.answered ?? 0) + 1,
          correct: (nextTopicStats[topic]?.correct ?? 0) + (item.isCorrect ? 1 : 0),
        };
        nextDiffStats[difficulty] = {
          answered: (nextDiffStats[difficulty]?.answered ?? 0) + 1,
          correct: (nextDiffStats[difficulty]?.correct ?? 0) + (item.isCorrect ? 1 : 0),
        };

        if (item.isCorrect) {
          correctSet.add(id);
          if (wrongSet.has(id)) {
            wrongSet.delete(id);
            mistakesFixed += 1;
          }
          if (kind === 'find-bug') bugFixed += 1;
          if (kind === 'fill-blank') fillBlankCorrect += 1;
          correctInSession += 1;
          runningStreak += 1;
          if (runningStreak > maxStreak) maxStreak = runningStreak;
        } else {
          wrongSet.add(id);
          runningStreak = 0;
        }
      }

      const total = payload.answers.length;
      const accuracy = total > 0 ? Math.round((correctInSession / total) * 100) : 0;
      const completedModes = progress.completedModes.includes(payload.mode)
        ? progress.completedModes
        : [...progress.completedModes, payload.mode];

      const todayKey = getLocalDateKey();
      const nextActivity = {
        ...progress.activityByDate,
        [todayKey]: (progress.activityByDate[todayKey] ?? 0) + total,
      };

      const sessionRecord = {
        id: `s-${Date.now()}`,
        mode: payload.mode,
        date: new Date().toISOString(),
        score: correctInSession,
        total,
        accuracy,
        xpEarned: payload.totalXpEarned,
        durationSec: payload.durationSec,
        bestStreak: payload.bestStreak,
      };

      const draft: UserProgress = {
        ...progress,
        xp: progress.xp + payload.totalXpEarned,
        totalAnswered: progress.totalAnswered + total,
        totalCorrect: progress.totalCorrect + correctInSession,
        bestStreak: maxStreak,
        currentStreak: runningStreak,
        answeredQuestionIds: Array.from(answeredSet),
        correctQuestionIds: Array.from(correctSet),
        wrongQuestionIds: Array.from(wrongSet),
        mistakesFixedCount: mistakesFixed,
        bugFixedCount: bugFixed,
        fillBlankCorrectCount: fillBlankCorrect,
        completedModes,
        activityByDate: nextActivity,
        topicStats: nextTopicStats,
        difficultyStats: nextDiffStats,
        sessions: [sessionRecord, ...progress.sessions].slice(0, 40),
      };

      const evaluated = evaluateAchievements(draft);
      const finalDraft = evaluated.updatedProgress;
      const eligibility = getCertificateEligibility(finalDraft);

      if (eligibility.courseCompleted && !finalDraft.certificateIssuedAt) {
        finalDraft.certificateIssuedAt = new Date().toISOString();
        finalDraft.certificateId = finalDraft.certificateId || generateCertificateId();
      }

      setProgress(finalDraft);

      if (evaluated.newlyUnlocked.length > 0) {
        setToastAchievement(evaluated.newlyUnlocked[0]);
        if (progress.soundEnabled) playAchievementSound();
      }

      return evaluated.newlyUnlocked;
    },
    [progress]
  );

  const handleResetProgress = useCallback(() => {
    setProgress(createInitialProgress());
  }, []);

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3] terminal-grid-bg flex flex-col">
      {/* Top Bar: Strict 3-Zone Contract */}
      <header className="no-print sticky top-0 z-30 border-b border-[#30363D] bg-[#0D1117]/95 backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('quiz')}
            className="font-mono text-lg font-bold tracking-tight text-[#E6EDF3] hover:text-[#3FB950] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#3FB950] rounded"
          >
            PyTerm
          </button>

          {/* Zone 2: Clean Single-Line Navigation Links */}
          <nav
            aria-label="Основная навигация"
            className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar"
          >
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 font-mono text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'border-[#3FB950] text-[#E6EDF3] font-medium'
                      : 'border-transparent text-[#8B949E] hover:text-[#E6EDF3]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="hidden sm:flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('github')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-medium rounded-lg border border-[#30363D] bg-[#161B22] hover:border-[#58A6FF] text-[#E6EDF3] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Github className="w-3.5 h-3.5 text-[#3FB950]" />
              <span className="max-w-[140px] truncate">
                {githubUser ? `@${githubUser.login}` : 'GitHub Gist'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {activeTab === 'quiz' && (
          <QuizArena
            progress={progress}
            githubUser={githubUser}
            syncingGitHub={syncingGitHub}
            initialModeRequest={requestedMode}
            onConsumeModeRequest={() => setRequestedMode(null)}
            onUpdateProfile={handleUpdateProfile}
            onToggleSound={handleToggleSound}
            onCompleteSession={handleCompleteSession}
            onQuickSaveGitHub={() => void handleSaveToGitHub(false, false)}
            onOpenGitHubTab={() => setActiveTab('github')}
            onOpenCertificateTab={() => setActiveTab('certificate')}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressDashboard
            progress={progress}
            onStartQuiz={() => setActiveTab('quiz')}
            onPracticeMistakes={() => {
              setRequestedMode('mistakes');
              setActiveTab('quiz');
            }}
            onResetProgress={handleResetProgress}
          />
        )}

        {activeTab === 'achievements' && (
          <AchievementsView
            progress={progress}
            onStartQuiz={() => setActiveTab('quiz')}
          />
        )}

        {activeTab === 'certificate' && (
          <CertificateView
            progress={progress}
            onUpdateProfile={handleUpdateProfile}
            onStartQuiz={() => setActiveTab('quiz')}
          />
        )}

        {activeTab === 'github' && (
          <GitHubSyncView
            progress={progress}
            githubConfig={githubConfig}
            githubUser={githubUser}
            savedGists={savedGists}
            loadingGists={loadingGists}
            syncing={syncingGitHub}
            restoringId={restoringId}
            statusMessage={ghStatus}
            onConnect={() => void handleConnectGitHub()}
            onDisconnect={() => void handleDisconnectGitHub()}
            onSaveToGist={(isPublic, createNew) => void handleSaveToGitHub(isPublic, createNew)}
            onRefreshGists={() => void fetchSavedGists()}
            onRestoreGist={(id) => void handleRestoreGist(id)}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="no-print border-t border-[#30363D] bg-[#0D1117]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-xs text-[#6E7681]">
          <span>PyTerm · Интерактивное обучение Python (11–14 лет)</span>
          <span>Прогресс хранится локально и синхронизируется с GitHub Gist</span>
        </div>
      </footer>

      {/* Achievement Unlock Notification Toast */}
      {toastAchievement && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-5 right-5 z-40 max-w-sm rounded-lg border border-[#E3B341]/70 bg-[#161B22] p-4 shadow-xl flex items-start gap-3"
        >
          <div className="space-y-1 flex-1 min-w-0">
            <div className="font-mono text-xs text-[#E3B341]">
              Новое достижение · +{toastAchievement.xpReward} XP
            </div>
            <div className="font-mono text-sm font-semibold text-[#E6EDF3]">
              {toastAchievement.asciiArt} {toastAchievement.title}
            </div>
            <p className="text-xs text-[#8B949E]">{toastAchievement.description}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastAchievement(null)}
            aria-label="Закрыть уведомление"
            className="text-[#8B949E] hover:text-[#E6EDF3] p-1 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
