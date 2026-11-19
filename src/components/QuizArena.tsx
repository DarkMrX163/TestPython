import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Lightbulb,
  Play,
  RotateCcw,
  Terminal,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ACHIEVEMENTS, getDeveloperRank } from '../data/achievements';
import { DIFFICULTY_META, QUESTIONS, TOPIC_META } from '../data/questions';
import type {
  AchievementDef,
  GitHubUser,
  Question,
  QuizMode,
  TopicId,
  UserProgress,
} from '../types';
import { PythonCodeBlock } from './PythonCodeBlock';
import { TerminalProgressBar } from './TerminalProgressBar';

export interface SessionAnswerLog {
  question: Question;
  selectedIndex: number;
  isCorrect: boolean;
  xpAwarded: number;
}

export interface QuizCompletionPayload {
  mode: QuizMode;
  answers: SessionAnswerLog[];
  durationSec: number;
  bestStreak: number;
  totalXpEarned: number;
}

interface QuizArenaProps {
  progress: UserProgress;
  githubUser: GitHubUser | null;
  syncingGitHub: boolean;
  onCompleteSession: (payload: QuizCompletionPayload) => AchievementDef[];
  onQuickSaveGitHub: () => void;
  onOpenGitHubTab: () => void;
}

type ArenaStage = 'setup' | 'playing' | 'summary';

const PYTHON_ASCII_ART = `  ____        _____
 |  _ \\ _   _|_   _|__ _ __ _ __ ___
 | |_) | | | | | |/ _ \\ '__| '_ \` _ \\
 |  __/| |_| | | |  __/ |  | | | | | |
 |_|    \\__, | |_|\\___|_|  |_| |_| |_|
        |___/`;

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function QuizArena({
  progress,
  githubUser,
  syncingGitHub,
  onCompleteSession,
  onQuickSaveGitHub,
  onOpenGitHubTab,
}: QuizArenaProps) {
  const [stage, setStage] = useState<ArenaStage>('setup');
  const [mode, setMode] = useState<QuizMode>('beginner');
  const [topicFilter, setTopicFilter] = useState<TopicId | 'all'>('all');
  const [requestedCount, setRequestedCount] = useState<number>(6);

  // Active session state
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [answersLog, setAnswersLog] = useState<SessionAnswerLog[]>([]);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [sessionBestStreak, setSessionBestStreak] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [newlyUnlocked, setNewlyUnlocked] = useState<AchievementDef[]>([]);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  const matchingPool = useMemo(() => {
    return QUESTIONS.filter((q) => {
      const modeOk = mode === 'mixed' || q.difficulty === mode;
      const topicOk = topicFilter === 'all' || q.topic === topicFilter;
      return modeOk && topicOk;
    });
  }, [mode, topicFilter]);

  const effectiveCount = Math.min(requestedCount, matchingPool.length);

  // Active timer
  useEffect(() => {
    if (stage !== 'playing') return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [stage]);

  const startQuiz = useCallback(() => {
    if (matchingPool.length === 0) return;

    // Prioritize unanswered or previously missed questions so learning stays fresh
    const solvedSet = new Set(progress.correctQuestionIds);
    const unsolved = shuffleArray(matchingPool.filter((q) => !solvedSet.has(q.id)));
    const solved = shuffleArray(matchingPool.filter((q) => solvedSet.has(q.id)));
    const chosen = [...unsolved, ...solved].slice(0, effectiveCount);

    setSessionQuestions(chosen);
    setCurrentIndex(0);
    setSelectedIndex(null);
    setShowHint(false);
    setAnswersLog([]);
    setSessionStreak(0);
    setSessionBestStreak(0);
    setElapsedSec(0);
    setNewlyUnlocked([]);
    setExpandedReviewId(null);
    setStage('playing');
  }, [matchingPool, effectiveCount, progress.correctQuestionIds]);

  const currentQuestion = sessionQuestions[currentIndex] ?? null;
  const isAnswered = selectedIndex !== null;

  const handleSelectOption = useCallback(
    (index: number) => {
      if (!currentQuestion || selectedIndex !== null) return;

      const isCorrect = index === currentQuestion.correctIndex;
      const nextStreak = isCorrect ? sessionStreak + 1 : 0;
      const nextBest = Math.max(sessionBestStreak, nextStreak);
      const streakBonus = isCorrect && nextStreak >= 3 ? Math.min(15, (nextStreak - 2) * 5) : 0;
      const xpAwarded = isCorrect ? currentQuestion.xp + streakBonus : 0;

      setSelectedIndex(index);
      setSessionStreak(nextStreak);
      setSessionBestStreak(nextBest);
      setAnswersLog((prev) => [
        ...prev,
        {
          question: currentQuestion,
          selectedIndex: index,
          isCorrect,
          xpAwarded,
        },
      ]);
    },
    [currentQuestion, selectedIndex, sessionStreak, sessionBestStreak]
  );

  const handleNext = useCallback(() => {
    if (!currentQuestion || selectedIndex === null) return;

    if (currentIndex + 1 < sessionQuestions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedIndex(null);
      setShowHint(false);
    } else {
      const totalXpEarned = answersLog.reduce((sum, item) => sum + item.xpAwarded, 0);
      const unlocked = onCompleteSession({
        mode,
        answers: answersLog,
        durationSec: Math.max(1, elapsedSec),
        bestStreak: sessionBestStreak,
        totalXpEarned,
      });
      setNewlyUnlocked(unlocked);
      setStage('summary');
    }
  }, [
    currentQuestion,
    selectedIndex,
    currentIndex,
    sessionQuestions.length,
    answersLog,
    onCompleteSession,
    mode,
    elapsedSec,
    sessionBestStreak,
  ]);

  // Keyboard shortcuts during active quiz: 1-4 to pick answer, Enter for next
  useEffect(() => {
    if (stage !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (selectedIndex === null) {
        if (e.key === '1') handleSelectOption(0);
        else if (e.key === '2') handleSelectOption(1);
        else if (e.key === '3') handleSelectOption(2);
        else if (e.key === '4') handleSelectOption(3);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage, selectedIndex, handleSelectOption, handleNext]);

  const rank = getDeveloperRank(progress.xp);
  const xpInCurrentRank = progress.xp - rank.minXp;
  const xpSpan = rank.nextXp ? rank.nextXp - rank.minXp : 1;

  // ===================== STAGE 1: SETUP =====================
  if (stage === 'setup') {
    const overallAccuracy =
      progress.totalAnswered > 0
        ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
        : 0;

    const cliPreview = `python3 pyterm.py --level=${mode}${
      topicFilter !== 'all' ? ` --topic=${topicFilter}` : ''
    } --tasks=${effectiveCount}`;

    return (
      <section className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Launchpad & Quiz Configuration */}
          <div className="lg:col-span-8 rounded-lg border border-[#30363D] bg-[#161B22] p-6 sm:p-8 flex flex-col justify-between gap-7">
            <div className="space-y-6">
              {/* Terminal ASCII Graphic + Title */}
              <div className="space-y-4">
                <pre
                  className="font-mono text-[10px] sm:text-xs leading-tight text-[#3FB950] overflow-x-auto select-none"
                  aria-hidden="true"
                >
                  {PYTHON_ASCII_ART}
                </pre>
                <div className="space-y-2">
                  <h1 className="font-mono text-2xl sm:text-3xl font-semibold text-[#E6EDF3] text-balance">
                    Интерактивный тренажёр по Python для 11–14 лет
                  </h1>
                  <p className="text-sm sm:text-base text-[#8B949E] leading-relaxed max-w-2xl">
                    Читай реальный код, угадывай вывод в терминале и разбирай подробные объяснения после каждой задачи. Зарабатывай опыт, открывай достижения и сохраняй результаты в GitHub.
                  </p>
                </div>
              </div>

              {/* Difficulty / Mode Selector */}
              <div className="space-y-3">
                <div className="font-mono text-xs text-[#8B949E]">
                  1. Выбери уровень сложности
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      {
                        id: 'beginner' as QuizMode,
                        title: 'Базовый',
                        meta: '11–12 лет · +15 XP',
                        desc: DIFFICULTY_META.beginner.description,
                      },
                      {
                        id: 'intermediate' as QuizMode,
                        title: 'Средний',
                        meta: '12–13 лет · +25 XP',
                        desc: DIFFICULTY_META.intermediate.description,
                      },
                      {
                        id: 'advanced' as QuizMode,
                        title: 'Продвинутый',
                        meta: '13–14 лет · +40 XP',
                        desc: DIFFICULTY_META.advanced.description,
                      },
                      {
                        id: 'mixed' as QuizMode,
                        title: 'Смешанный вызов',
                        meta: 'Все уровни · до +40 XP',
                        desc: 'Задачи разной сложности вперемешку для комплексной проверки.',
                      },
                    ]
                  ).map((item) => {
                    const active = mode === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setMode(item.id);
                          setTopicFilter('all');
                        }}
                        className={`text-left p-4 rounded-lg border transition-colors cursor-pointer space-y-1.5 focus-visible:outline-2 focus-visible:outline-[#3FB950] ${
                          active
                            ? 'border-[#3FB950] bg-[#0D1117]'
                            : 'border-[#30363D] bg-[#0D1117]/40 hover:border-[#484F58]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-mono">
                          <span className="text-sm font-semibold text-[#E6EDF3]">
                            {item.title}
                          </span>
                          <span
                            className={`text-xs whitespace-nowrap shrink-0 ${
                              active ? 'text-[#3FB950]' : 'text-[#8B949E]'
                            }`}
                          >
                            {item.meta}
                          </span>
                        </div>
                        <p className="text-xs text-[#8B949E] leading-relaxed">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Topic Filter & Question Count */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 pt-2">
                <div className="sm:col-span-8 space-y-2.5">
                  <div className="font-mono text-xs text-[#8B949E]">2. Тема задач</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTopicFilter('all')}
                      className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                        topicFilter === 'all'
                          ? 'bg-[#21262D] border-[#58A6FF] text-[#E6EDF3]'
                          : 'bg-[#0D1117]/50 border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3]'
                      }`}
                    >
                      Все темы
                    </button>
                    {(Object.keys(TOPIC_META) as TopicId[]).map((tid) => {
                      const availableInMode = QUESTIONS.some(
                        (q) => (mode === 'mixed' || q.difficulty === mode) && q.topic === tid
                      );
                      if (!availableInMode) return null;
                      const active = topicFilter === tid;
                      return (
                        <button
                          key={tid}
                          type="button"
                          onClick={() => setTopicFilter(tid)}
                          className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-[#21262D] border-[#58A6FF] text-[#E6EDF3]'
                              : 'bg-[#0D1117]/50 border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3]'
                          }`}
                        >
                          {TOPIC_META[tid].shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-4 space-y-2.5">
                  <div className="font-mono text-xs text-[#8B949E]">3. Кол-во задач</div>
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#0D1117] border border-[#30363D]">
                    {[5, 6, 8, 10].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setRequestedCount(cnt)}
                        className={`px-3 py-1.5 text-xs font-mono rounded transition-colors cursor-pointer tabular-nums whitespace-nowrap ${
                          requestedCount === cnt
                            ? 'bg-[#21262D] text-[#E6EDF3]'
                            : 'text-[#8B949E] hover:text-[#E6EDF3]'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal Launch Bar */}
            <div className="pt-5 border-t border-[#30363D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="font-mono text-xs text-[#8B949E] bg-[#0D1117] border border-[#30363D] rounded-lg px-3.5 py-2.5 overflow-x-auto whitespace-nowrap">
                <span className="text-[#3FB950] select-none mr-2">{rank.promptSymbol}</span>
                <span className="text-[#E6EDF3]">{cliPreview}</span>
                <span className="terminal-cursor ml-1" aria-hidden="true" />
              </div>

              <button
                type="button"
                disabled={effectiveCount === 0}
                onClick={startQuiz}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-mono font-semibold bg-[#2EA043] hover:bg-[#3FB950] disabled:opacity-50 text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3FB950]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Начать тест ({effectiveCount})</span>
              </button>
            </div>
          </div>

          {/* Right: Developer Profile & Quick Stats */}
          <aside className="lg:col-span-4 rounded-lg border border-[#30363D] bg-[#161B22] p-6 flex flex-col justify-between gap-6">
            <div className="space-y-6">
              <div className="space-y-2 pb-5 border-b border-[#30363D]">
                <div className="font-mono text-xs text-[#8B949E]">
                  Профиль разработчика · Уровень {rank.level}
                </div>
                <div className="font-mono text-xl font-semibold text-[#E6EDF3]">
                  {rank.title}
                </div>
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs tabular-nums">
                    <span className="text-[#E3B341] font-medium">{progress.xp} XP</span>
                    <span className="text-[#8B949E]">
                      {rank.nextXp ? `До след. уровня: ${rank.nextXp - progress.xp} XP` : 'Максимальный ранг'}
                    </span>
                  </div>
                  <TerminalProgressBar
                    value={rank.nextXp ? xpInCurrentRank : 1}
                    max={rank.nextXp ? xpSpan : 1}
                    segments={18}
                    accent="gold"
                    label="Прогресс до следующего ранга"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono">
                <div className="space-y-1">
                  <div className="text-xs text-[#8B949E]">Решено верно</div>
                  <div className="text-xl font-semibold text-[#E6EDF3] tabular-nums">
                    {progress.correctQuestionIds.length} / {QUESTIONS.length}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-[#8B949E]">Точность</div>
                  <div className="text-xl font-semibold text-[#3FB950] tabular-nums">
                    {overallAccuracy}%
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-[#8B949E]">Лучшая серия</div>
                  <div className="text-xl font-semibold text-[#58A6FF] tabular-nums">
                    {progress.bestStreak}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-[#8B949E]">Достижения</div>
                  <div className="text-xl font-semibold text-[#E3B341] tabular-nums">
                    {progress.unlockedAchievements.length} / {ACHIEVEMENTS.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Session Snippet */}
            <div className="pt-5 border-t border-[#30363D] space-y-2.5 font-mono text-xs">
              <div className="text-[#8B949E]">Последняя тренировка</div>
              {progress.sessions.length > 0 ? (
                <div className="p-3.5 rounded-lg bg-[#0D1117] border border-[#30363D] space-y-1.5 tabular-nums">
                  <div className="flex items-center justify-between text-[#E6EDF3]">
                    <span>
                      {progress.sessions[0].mode === 'mixed'
                        ? 'Смешанный'
                        : DIFFICULTY_META[progress.sessions[0].mode].label}
                    </span>
                    <span className="text-[#3FB950] font-medium">
                      {progress.sessions[0].score}/{progress.sessions[0].total} (
                      {progress.sessions[0].accuracy}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#8B949E]">
                    <span>+{progress.sessions[0].xpEarned} XP</span>
                    <span>{formatTimer(progress.sessions[0].durationSec)}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg bg-[#0D1117] border border-[#30363D] text-[#8B949E] leading-relaxed">
                  Запусти первую викторину, чтобы получить ранг и открыть значок «Первый запуск».
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    );
  }

  // ===================== STAGE 2: ACTIVE QUIZ =====================
  if (stage === 'playing' && currentQuestion) {
    const diffLabel = DIFFICULTY_META[currentQuestion.difficulty].label;
    const topicLabel = TOPIC_META[currentQuestion.topic].label;
    const lastAnswer = isAnswered ? answersLog[answersLog.length - 1] : null;

    return (
      <section className="space-y-6">
        {/* Session Status Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#30363D]">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs sm:text-sm text-[#8B949E] tabular-nums">
            <span className="text-[#E6EDF3] font-semibold">
              Задача {currentIndex + 1} / {sessionQuestions.length}
            </span>
            <span aria-hidden="true">·</span>
            <span>{diffLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{topicLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#E3B341]">+{currentQuestion.xp} XP</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono text-xs tabular-nums">
            <span className="text-[#8B949E]">
              Серия:{' '}
              <strong className={sessionStreak >= 3 ? 'text-[#E3B341]' : 'text-[#E6EDF3]'}>
                {sessionStreak}
              </strong>
            </span>
            <span className="text-[#8B949E]">
              Время: <strong className="text-[#E6EDF3]">{formatTimer(elapsedSec)}</strong>
            </span>
            <TerminalProgressBar
              value={currentIndex + (isAnswered ? 1 : 0)}
              max={sessionQuestions.length}
              segments={12}
              accent="emerald"
              label="Прогресс текущей викторины"
            />
            <button
              type="button"
              onClick={() => setStage('setup')}
              className="text-[#8B949E] hover:text-[#E6EDF3] underline underline-offset-4 cursor-pointer whitespace-nowrap"
            >
              Выйти
            </button>
          </div>
        </div>

        {/* Two-Zone Interactive Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Zone: Code + Options */}
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 rounded-lg border border-[#30363D] bg-[#161B22] p-5 sm:p-6 space-y-5"
          >
            <h2 className="font-mono text-lg sm:text-xl font-semibold text-[#E6EDF3] leading-snug text-balance">
              {currentQuestion.prompt}
            </h2>

            {currentQuestion.code && (
              <PythonCodeBlock
                code={currentQuestion.code}
                filename={`task_${currentIndex + 1}.py`}
              />
            )}

            {/* Answer Options */}
            <div className="space-y-2.5 pt-1" role="group" aria-label="Варианты ответа">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedIndex === idx;
                const isCorrectOpt = idx === currentQuestion.correctIndex;

                let stateClasses =
                  'border-[#30363D] bg-[#0D1117] hover:border-[#58A6FF] hover:bg-[#1C2128] text-[#E6EDF3]';
                let statusBadge: string | null = null;

                if (isAnswered) {
                  if (isCorrectOpt) {
                    stateClasses = 'border-[#3FB950] bg-[#2EA043]/15 text-[#E6EDF3]';
                    statusBadge = 'Верно';
                  } else if (isSelected && !isCorrectOpt) {
                    stateClasses = 'border-[#F85149] bg-[#F85149]/12 text-[#E6EDF3]';
                    statusBadge = 'Твой выбор';
                  } else {
                    stateClasses = 'border-[#30363D]/70 bg-[#0D1117]/40 text-[#6E7681]';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full min-h-[48px] px-4 py-3 rounded-lg border text-left font-mono text-sm flex items-center justify-between gap-3 transition-colors focus-visible:outline-2 focus-visible:outline-[#3FB950] ${stateClasses} ${
                      isAnswered ? 'cursor-default' : 'cursor-pointer'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-[#8B949E] shrink-0 select-none">
                        [{idx + 1}]
                      </span>
                      <span className="break-words">{option}</span>
                    </span>

                    {isAnswered && isCorrectOpt && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#3FB950] whitespace-nowrap shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{statusBadge}</span>
                      </span>
                    )}
                    {isAnswered && isSelected && !isCorrectOpt && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#F85149] whitespace-nowrap shrink-0">
                        <XCircle className="w-4 h-4" />
                        <span>{statusBadge}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Next Action */}
            {isAnswered && (
              <div className="pt-2 flex items-center justify-between gap-4">
                <span className="hidden sm:inline font-mono text-xs text-[#8B949E]">
                  Нажми Enter для перехода дальше
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 text-sm font-mono font-semibold bg-[#2EA043] hover:bg-[#3FB950] text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3FB950]"
                >
                  <span>
                    {currentIndex + 1 < sessionQuestions.length
                      ? 'Следующий вопрос'
                      : 'Показать итоги'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>

          {/* Right Zone: Python REPL & Detailed Explanation Console */}
          <aside className="lg:col-span-5 rounded-lg border border-[#30363D] bg-[#161B22] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#30363D] bg-[#0D1117] flex items-center justify-between font-mono text-xs text-[#8B949E]">
              <span className="inline-flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-[#3FB950]" />
                <span>Консоль разбора Python</span>
              </span>
              <span>Python 3.12</span>
            </div>

            {!isAnswered ? (
              <div className="p-5 sm:p-6 space-y-5">
                <div className="font-mono text-xs text-[#8B949E] leading-relaxed">
                  <span className="text-[#3FB950]">$</span> python3 task_{currentIndex + 1}.py
                  <div className="mt-2 text-[#6E7681]">
                    Ожидание ответа... Выбери вариант [1–4], чтобы увидеть вывод терминала и подробный разбор решения.
                  </div>
                </div>

                <div className="pt-4 border-t border-[#30363D] space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowHint((prev) => !prev)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-mono text-[#E3B341] border border-[#30363D] hover:border-[#E3B341]/60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>{showHint ? 'Скрыть подсказку' : 'Показать подсказку'}</span>
                  </button>

                  {showHint && (
                    <div className="p-3.5 rounded-lg bg-[#0D1117] border border-[#30363D] text-sm text-[#C9D1D9] leading-relaxed">
                      {currentQuestion.hint}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#30363D] font-mono text-xs text-[#6E7681] space-y-1">
                  <div>Клавиши 1–4 — быстрый выбор варианта</div>
                  <div>Клавиша Enter — следующий вопрос</div>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="p-5 sm:p-6 space-y-5"
              >
                {/* Simulated Terminal Output */}
                <div className="rounded-lg bg-[#0D1117] border border-[#30363D] p-4 font-mono text-xs sm:text-sm space-y-2">
                  <div className="text-[#8B949E]">
                    <span className="text-[#3FB950]">$</span> python3 task_{currentIndex + 1}.py
                  </div>
                  <div
                    className={
                      currentQuestion.terminalOutput.includes('Error')
                        ? 'text-[#F85149]'
                        : 'text-[#E6EDF3]'
                    }
                  >
                    {currentQuestion.terminalOutput}
                  </div>
                </div>

                {/* Verdict */}
                {lastAnswer && (
                  <div
                    className={`flex items-center justify-between gap-3 font-mono text-sm font-medium pb-3 border-b border-[#30363D] ${
                      lastAnswer.isCorrect ? 'text-[#3FB950]' : 'text-[#F85149]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {lastAnswer.isCorrect ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Отлично! Ответ верный</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 shrink-0" />
                          <span>Не совсем так</span>
                        </>
                      )}
                    </span>
                    {lastAnswer.isCorrect && (
                      <span className="text-[#E3B341] tabular-nums whitespace-nowrap">
                        +{lastAnswer.xpAwarded} XP
                      </span>
                    )}
                  </div>
                )}

                {/* Explanation */}
                <div className="space-y-2">
                  <h3 className="font-mono text-xs font-semibold text-[#8B949E]">
                    Почему это работает так
                  </h3>
                  <p className="text-sm text-[#E6EDF3] leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>

                {/* Developer Tip */}
                <div className="rounded-lg border border-[#30363D] bg-[#0D1117] p-4 space-y-1.5">
                  <div className="font-mono text-xs font-semibold text-[#58A6FF]">
                    Совет разработчика
                  </div>
                  <p className="text-xs sm:text-sm text-[#C9D1D9] leading-relaxed">
                    {currentQuestion.tip}
                  </p>
                </div>
              </motion.div>
            )}
          </aside>
        </div>
      </section>
    );
  }

  // ===================== STAGE 3: SUMMARY =====================
  const correctCount = answersLog.filter((a) => a.isCorrect).length;
  const totalCount = answersLog.length;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const sessionXp = answersLog.reduce((sum, a) => sum + a.xpAwarded, 0);
  const achBonusXp = newlyUnlocked.reduce((sum, a) => sum + a.xpReward, 0);

  return (
    <section className="space-y-8">
      <div className="rounded-lg border border-[#30363D] bg-[#161B22] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#30363D]">
          <div className="space-y-2">
            <div className="font-mono text-xs text-[#3FB950]">
              Сессия завершена · {mode === 'mixed' ? 'Смешанный вызов' : DIFFICULTY_META[mode].label}
            </div>
            <h1 className="font-mono text-2xl sm:text-3xl font-semibold text-[#E6EDF3] text-balance">
              {accuracy === 100
                ? 'Безупречное выполнение кода!'
                : accuracy >= 75
                  ? 'Отличный результат, так держать!'
                  : accuracy >= 50
                    ? 'Хорошая тренировка — посмотри разбор ошибок'
                    : 'Первый шаг сделан — разберём задачи и попробуем снова'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={startQuiz}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-mono font-semibold bg-[#2EA043] hover:bg-[#3FB950] text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Пройти ещё раз</span>
            </button>

            <button
              type="button"
              disabled={syncingGitHub}
              onClick={githubUser ? onQuickSaveGitHub : onOpenGitHubTab}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-mono text-[#E6EDF3] border border-[#30363D] hover:bg-[#21262D] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <CloudUpload className="w-4 h-4 text-[#58A6FF]" />
              <span>
                {syncingGitHub
                  ? 'Сохранение...'
                  : githubUser
                    ? 'Сохранить в GitHub'
                    : 'Экспорт в GitHub'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStage('setup')}
              className="px-4 py-2.5 text-sm font-mono text-[#8B949E] hover:text-[#E6EDF3] transition-colors cursor-pointer whitespace-nowrap"
            >
              Настройки теста
            </button>
          </div>
        </div>

        {/* Summary Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono tabular-nums">
          <div className="p-4 rounded-lg bg-[#0D1117] border border-[#30363D] space-y-1">
            <div className="text-xs text-[#8B949E]">Результат</div>
            <div className="text-2xl font-semibold text-[#E6EDF3]">
              {correctCount} / {totalCount}
            </div>
            <div className="text-xs text-[#3FB950]">{accuracy}% точности</div>
          </div>

          <div className="p-4 rounded-lg bg-[#0D1117] border border-[#30363D] space-y-1">
            <div className="text-xs text-[#8B949E]">Заработано опыта</div>
            <div className="text-2xl font-semibold text-[#E3B341]">
              +{sessionXp + achBonusXp} XP
            </div>
            <div className="text-xs text-[#8B949E]">
              {achBonusXp > 0 ? `вкл. +${achBonusXp} за значки` : 'с учётом серии'}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#0D1117] border border-[#30363D] space-y-1">
            <div className="text-xs text-[#8B949E]">Лучшая серия</div>
            <div className="text-2xl font-semibold text-[#58A6FF]">{sessionBestStreak}</div>
            <div className="text-xs text-[#8B949E]">подряд в тесте</div>
          </div>

          <div className="p-4 rounded-lg bg-[#0D1117] border border-[#30363D] space-y-1">
            <div className="text-xs text-[#8B949E]">Время</div>
            <div className="text-2xl font-semibold text-[#E6EDF3]">{formatTimer(elapsedSec)}</div>
            <div className="text-xs text-[#8B949E]">мин : сек</div>
          </div>
        </div>

        {/* Newly Unlocked Achievements */}
        {newlyUnlocked.length > 0 && (
          <div className="rounded-lg border border-[#E3B341]/50 bg-[#0D1117] p-5 space-y-3">
            <div className="font-mono text-xs font-semibold text-[#E3B341]">
              Открыты новые достижения ({newlyUnlocked.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {newlyUnlocked.map((ach) => (
                <div
                  key={ach.id}
                  className="flex items-start justify-between gap-3 p-3 rounded border border-[#30363D] bg-[#161B22]"
                >
                  <div className="space-y-1">
                    <div className="font-mono text-xs text-[#E3B341]">{ach.asciiArt}</div>
                    <div className="font-mono text-sm font-semibold text-[#E6EDF3]">
                      {ach.title}
                    </div>
                    <p className="text-xs text-[#8B949E]">{ach.description}</p>
                  </div>
                  <span className="font-mono text-xs text-[#E3B341] whitespace-nowrap shrink-0">
                    +{ach.xpReward} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Review All Answers */}
      <div className="rounded-lg border border-[#30363D] bg-[#161B22] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#30363D] flex items-center justify-between">
          <h2 className="font-mono text-base font-semibold text-[#E6EDF3]">
            Разбор ответов сессии
          </h2>
          <span className="font-mono text-xs text-[#8B949E]">
            Нажми на задачу, чтобы открыть код и объяснение
          </span>
        </div>

        <div className="divide-y divide-[#30363D]">
          {answersLog.map((entry, idx) => {
            const expanded = expandedReviewId === entry.question.id;
            return (
              <div key={entry.question.id}>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedReviewId(expanded ? null : entry.question.id)
                  }
                  className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#21262D]/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {entry.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-[#3FB950] shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#F85149] shrink-0" />
                    )}
                    <span className="font-mono text-xs text-[#8B949E] shrink-0 tabular-nums">
                      #{idx + 1}
                    </span>
                    <span className="text-sm text-[#E6EDF3] truncate">
                      {entry.question.prompt}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                    <span className={entry.isCorrect ? 'text-[#3FB950]' : 'text-[#F85149]'}>
                      {entry.isCorrect ? 'Верно' : 'Ошибка'}
                    </span>
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-[#8B949E]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#8B949E]" />
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="px-6 pb-5 pt-2 bg-[#0D1117]/60 space-y-4">
                    {entry.question.code && (
                      <PythonCodeBlock code={entry.question.code} filename={`review_${idx + 1}.py`} />
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                      <div className="p-3 rounded border border-[#30363D] bg-[#161B22]">
                        <div className="text-[#8B949E] mb-1">Твой ответ</div>
                        <div className={entry.isCorrect ? 'text-[#3FB950]' : 'text-[#F85149]'}>
                          {entry.question.options[entry.selectedIndex]}
                        </div>
                      </div>
                      <div className="p-3 rounded border border-[#30363D] bg-[#161B22]">
                        <div className="text-[#8B949E] mb-1">Правильный ответ</div>
                        <div className="text-[#3FB950]">
                          {entry.question.options[entry.question.correctIndex]}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-[#C9D1D9] leading-relaxed">
                      {entry.question.explanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
