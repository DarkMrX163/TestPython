import {
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Lightbulb,
  Play,
  RotateCcw,
  Terminal,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACHIEVEMENTS, getDeveloperRank } from '../data/achievements';
import {
  DIFFICULTY_META,
  QUESTION_KIND_META,
  QUESTIONS,
  QUIZ_MODE_LABELS,
  TOPIC_META,
} from '../data/questions';
import type {
  AchievementDef,
  Difficulty,
  GitHubUser,
  Question,
  QuestionKind,
  QuizMode,
  StudentProfile,
  TopicId,
  UserProgress,
} from '../types';
import { playCorrectSound, playStepTick, playWrongSound } from '../utils/sound';
import {
  CERTIFICATE_MIN_SOLVED,
  calculateDailyStreak,
  getCertificateEligibility,
} from '../utils/storage';
import { ExecutionTracePanel } from './ExecutionTracePanel';
import { PythonCodeBlock } from './PythonCodeBlock';
import { StudentProfileForm } from './StudentProfileForm';
import { TerminalProgressBar } from './TerminalProgressBar';

export interface SessionAnswerLog {
  question: Question;
  userAnswerLabel: string;
  correctAnswerLabel: string;
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
  initialModeRequest?: QuizMode | null;
  onConsumeModeRequest?: () => void;
  onUpdateProfile: (profile: StudentProfile) => void;
  onToggleSound: () => void;
  onCompleteSession: (payload: QuizCompletionPayload) => AchievementDef[];
  onQuickSaveGitHub: () => void;
  onOpenGitHubTab: () => void;
  onOpenCertificateTab: () => void;
}

type ArenaStage = 'setup' | 'playing' | 'summary';

const PYTHON_ASCII_ART = `  ____        _____
 |  _ \\ _   _|_   _|__ _ __ _ __ ___
 | |_) | | | | | |/ _ \\ '__| '_ \` _ \\
 |  __/| |_| | | |  __/ |  | | | | | |
 |_|    \\__, | |_|\\___|_|  |_| |_| |_|
        |___/`;

const DIFF_ORDER: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

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

function getCorrectLabel(q: Question): string {
  if (q.kind === 'choice' && q.options && q.correctIndex !== undefined) {
    return q.options[q.correctIndex];
  }
  if (q.kind === 'fill-blank' && q.acceptedAnswers?.length) {
    return q.acceptedAnswers[0];
  }
  if (q.kind === 'find-bug' && q.buggyLine) {
    return `Строка ${q.buggyLine}`;
  }
  return '';
}

function pickAdaptiveQuestion(
  targetDifficulty: Difficulty,
  usedIds: Set<string>,
  solvedIds: Set<string>,
  topicFilter: TopicId | 'all',
  kindFilter: QuestionKind | 'all'
): Question | null {
  const baseFilter = (q: Question) =>
    !usedIds.has(q.id) &&
    (topicFilter === 'all' || q.topic === topicFilter) &&
    (kindFilter === 'all' || q.kind === kindFilter);

  const exactPool = QUESTIONS.filter((q) => q.difficulty === targetDifficulty && baseFilter(q));
  const exactUnsolved = exactPool.filter((q) => !solvedIds.has(q.id));
  if (exactUnsolved.length > 0) {
    return shuffleArray(exactUnsolved)[0];
  }
  if (exactPool.length > 0) {
    return shuffleArray(exactPool)[0];
  }

  // Fallback to any remaining question matching topic & kind
  const anyPool = QUESTIONS.filter(baseFilter);
  if (anyPool.length > 0) {
    return shuffleArray(anyPool)[0];
  }
  return null;
}

export function QuizArena({
  progress,
  githubUser,
  syncingGitHub,
  initialModeRequest,
  onConsumeModeRequest,
  onUpdateProfile,
  onToggleSound,
  onCompleteSession,
  onQuickSaveGitHub,
  onOpenGitHubTab,
  onOpenCertificateTab,
}: QuizArenaProps) {
  const [stage, setStage] = useState<ArenaStage>('setup');
  const [mode, setMode] = useState<QuizMode>('adaptive');
  const [topicFilter, setTopicFilter] = useState<TopicId | 'all'>('all');
  const [kindFilter, setKindFilter] = useState<QuestionKind | 'all'>('all');
  const [requestedCount, setRequestedCount] = useState<number>(6);

  // Active session state
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [targetTotal, setTargetTotal] = useState<number>(6);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [adaptiveLevel, setAdaptiveLevel] = useState<Difficulty>('beginner');
  const [adaptiveNotice, setAdaptiveNotice] = useState<string | null>(null);
  const [consecutiveAtLevel, setConsecutiveAtLevel] = useState(0);

  // Per-question answer state
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedChoiceIdx, setSelectedChoiceIdx] = useState<number | null>(null);
  const [blankInput, setBlankInput] = useState('');
  const [selectedBugLine, setSelectedBugLine] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [traceStepIndex, setTraceStepIndex] = useState(0);

  // Session telemetry
  const [answersLog, setAnswersLog] = useState<SessionAnswerLog[]>([]);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [sessionBestStreak, setSessionBestStreak] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [newlyUnlocked, setNewlyUnlocked] = useState<AchievementDef[]>([]);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  const blankInputRef = useRef<HTMLInputElement | null>(null);

  // Apply external mode switch (e.g. "Разобрать ошибки" from Progress tab)
  useEffect(() => {
    if (initialModeRequest) {
      setMode(initialModeRequest);
      setTopicFilter('all');
      setKindFilter('all');
      setStage('setup');
      onConsumeModeRequest?.();
    }
  }, [initialModeRequest, onConsumeModeRequest]);

  const matchingPool = useMemo(() => {
    if (mode === 'mistakes') {
      const wrongSet = new Set(progress.wrongQuestionIds);
      return QUESTIONS.filter(
        (q) =>
          wrongSet.has(q.id) &&
          (topicFilter === 'all' || q.topic === topicFilter) &&
          (kindFilter === 'all' || q.kind === kindFilter)
      );
    }

    return QUESTIONS.filter((q) => {
      const modeOk = mode === 'mixed' || mode === 'adaptive' || q.difficulty === mode;
      const topicOk = topicFilter === 'all' || q.topic === topicFilter;
      const kindOk = kindFilter === 'all' || q.kind === kindFilter;
      return modeOk && topicOk && kindOk;
    });
  }, [mode, topicFilter, kindFilter, progress.wrongQuestionIds]);

  const effectiveCount = Math.min(requestedCount, matchingPool.length);

  // Active timer
  useEffect(() => {
    if (stage !== 'playing') return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [stage]);

  const currentQuestion = sessionQuestions[currentIndex] ?? null;

  // Focus text input automatically on fill-blank questions
  useEffect(() => {
    if (stage === 'playing' && currentQuestion?.kind === 'fill-blank' && !isAnswered) {
      blankInputRef.current?.focus();
    }
  }, [stage, currentQuestion, isAnswered]);

  const resetPerQuestionState = () => {
    setIsAnswered(false);
    setSelectedChoiceIdx(null);
    setBlankInput('');
    setSelectedBugLine(null);
    setShowHint(false);
    setTraceStepIndex(0);
  };

  const startQuiz = useCallback(
    (overrideMode?: QuizMode) => {
      const activeMode = overrideMode ?? mode;
      const solvedSet = new Set(progress.correctQuestionIds);

      let pool: Question[];
      if (activeMode === 'mistakes') {
        const wrongSet = new Set(progress.wrongQuestionIds);
        pool = QUESTIONS.filter(
          (q) =>
            wrongSet.has(q.id) &&
            (topicFilter === 'all' || q.topic === topicFilter) &&
            (kindFilter === 'all' || q.kind === kindFilter)
        );
      } else {
        pool = QUESTIONS.filter((q) => {
          const modeOk =
            activeMode === 'mixed' || activeMode === 'adaptive' || q.difficulty === activeMode;
          const topicOk = topicFilter === 'all' || q.topic === topicFilter;
          const kindOk = kindFilter === 'all' || q.kind === kindFilter;
          return modeOk && topicOk && kindOk;
        });
      }

      const count = Math.min(requestedCount, pool.length);
      if (count === 0) return;

      if (activeMode === 'adaptive') {
        const startDiff: Difficulty =
          progress.difficultyStats.beginner.correct >= 6 ? 'intermediate' : 'beginner';
        const firstQ = pickAdaptiveQuestion(
          startDiff,
          new Set(),
          solvedSet,
          topicFilter,
          kindFilter
        );
        if (!firstQ) return;
        setAdaptiveLevel(firstQ.difficulty);
        setConsecutiveAtLevel(0);
        setAdaptiveNotice(null);
        setSessionQuestions([firstQ]);
        setTargetTotal(count);
      } else {
        const unsolved = shuffleArray(pool.filter((q) => !solvedSet.has(q.id)));
        const solved = shuffleArray(pool.filter((q) => solvedSet.has(q.id)));
        const chosen = [...unsolved, ...solved].slice(0, count);
        setSessionQuestions(chosen);
        setTargetTotal(chosen.length);
        setAdaptiveNotice(null);
      }

      if (overrideMode) setMode(overrideMode);
      setCurrentIndex(0);
      resetPerQuestionState();
      setAnswersLog([]);
      setSessionStreak(0);
      setSessionBestStreak(0);
      setElapsedSec(0);
      setNewlyUnlocked([]);
      setExpandedReviewId(null);
      setStage('playing');
    },
    [
      mode,
      progress.correctQuestionIds,
      progress.wrongQuestionIds,
      progress.difficultyStats.beginner.correct,
      topicFilter,
      kindFilter,
      requestedCount,
    ]
  );

  const finalizeAnswer = useCallback(
    (isCorrect: boolean, userAnswerLabel: string) => {
      if (!currentQuestion || isAnswered) return;

      const nextStreak = isCorrect ? sessionStreak + 1 : 0;
      const nextBest = Math.max(sessionBestStreak, nextStreak);
      const comboMultiplier = nextStreak >= 5 ? 1.5 : nextStreak >= 3 ? 1.25 : 1;
      const xpAwarded = isCorrect ? Math.round(currentQuestion.xp * comboMultiplier) : 0;

      setIsAnswered(true);
      setSessionStreak(nextStreak);
      setSessionBestStreak(nextBest);
      setTraceStepIndex(0);

      if (progress.soundEnabled) {
        if (isCorrect) playCorrectSound(nextStreak);
        else playWrongSound();
      }

      // Adaptive difficulty recalculation for next question
      if (mode === 'adaptive') {
        const currentIdx = DIFF_ORDER.indexOf(adaptiveLevel);
        if (isCorrect) {
          const nextConsec = consecutiveAtLevel + 1;
          if (nextConsec >= 2 && currentIdx < DIFF_ORDER.length - 1) {
            const nextDiff = DIFF_ORDER[currentIdx + 1];
            setAdaptiveLevel(nextDiff);
            setConsecutiveAtLevel(0);
            setAdaptiveNotice(`Сложность повышена → ${DIFFICULTY_META[nextDiff].label}`);
          } else {
            setConsecutiveAtLevel(nextConsec);
            setAdaptiveNotice(null);
          }
        } else {
          setConsecutiveAtLevel(0);
          if (currentIdx > 0) {
            const prevDiff = DIFF_ORDER[currentIdx - 1];
            setAdaptiveLevel(prevDiff);
            setAdaptiveNotice(`Подбираем задачу на закрепление → ${DIFFICULTY_META[prevDiff].label}`);
          } else {
            setAdaptiveNotice(null);
          }
        }
      }

      setAnswersLog((prev) => [
        ...prev,
        {
          question: currentQuestion,
          userAnswerLabel,
          correctAnswerLabel: getCorrectLabel(currentQuestion),
          isCorrect,
          xpAwarded,
        },
      ]);
    },
    [
      currentQuestion,
      isAnswered,
      sessionStreak,
      sessionBestStreak,
      progress.soundEnabled,
      mode,
      adaptiveLevel,
      consecutiveAtLevel,
    ]
  );

  const handleSelectChoice = useCallback(
    (idx: number) => {
      if (!currentQuestion || currentQuestion.kind !== 'choice' || isAnswered || !currentQuestion.options) {
        return;
      }
      setSelectedChoiceIdx(idx);
      const isCorrect = idx === currentQuestion.correctIndex;
      finalizeAnswer(isCorrect, currentQuestion.options[idx]);
    },
    [currentQuestion, isAnswered, finalizeAnswer]
  );

  const handleSubmitBlank = useCallback(
    (valueOverride?: string) => {
      if (!currentQuestion || currentQuestion.kind !== 'fill-blank' || isAnswered) return;
      const raw = (valueOverride ?? blankInput).trim();
      if (!raw) return;
      setBlankInput(raw);
      const accepted = (currentQuestion.acceptedAnswers ?? []).map((a) => a.trim());
      const isCorrect = accepted.includes(raw);
      finalizeAnswer(isCorrect, raw);
    },
    [currentQuestion, isAnswered, blankInput, finalizeAnswer]
  );

  const handleSelectBugLine = useCallback(
    (lineNum: number) => {
      if (!currentQuestion || currentQuestion.kind !== 'find-bug' || isAnswered) return;
      setSelectedBugLine(lineNum);
      const isCorrect = lineNum === currentQuestion.buggyLine;
      finalizeAnswer(isCorrect, `Строка ${lineNum}`);
    },
    [currentQuestion, isAnswered, finalizeAnswer]
  );

  const handleNext = useCallback(() => {
    if (!currentQuestion || !isAnswered) return;

    if (currentIndex + 1 < targetTotal) {
      if (mode === 'adaptive' && currentIndex + 1 >= sessionQuestions.length) {
        const usedIds = new Set(sessionQuestions.map((q) => q.id));
        const solvedSet = new Set(progress.correctQuestionIds);
        const nextQ = pickAdaptiveQuestion(
          adaptiveLevel,
          usedIds,
          solvedSet,
          topicFilter,
          kindFilter
        );
        if (nextQ) {
          setSessionQuestions((prev) => [...prev, nextQ]);
          setCurrentIndex((prev) => prev + 1);
          resetPerQuestionState();
          return;
        }
      } else if (currentIndex + 1 < sessionQuestions.length) {
        setCurrentIndex((prev) => prev + 1);
        resetPerQuestionState();
        return;
      }
    }

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
  }, [
    currentQuestion,
    isAnswered,
    currentIndex,
    targetTotal,
    mode,
    sessionQuestions,
    progress.correctQuestionIds,
    adaptiveLevel,
    topicFilter,
    kindFilter,
    answersLog,
    onCompleteSession,
    elapsedSec,
    sessionBestStreak,
  ]);

  // Keyboard shortcuts during active quiz
  useEffect(() => {
    if (stage !== 'playing' || !currentQuestion) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const inInput =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      if (!isAnswered) {
        if (inInput) return;
        if (currentQuestion.kind === 'choice') {
          if (e.key === '1') handleSelectChoice(0);
          else if (e.key === '2') handleSelectChoice(1);
          else if (e.key === '3') handleSelectChoice(2);
          else if (e.key === '4') handleSelectChoice(3);
        } else if (currentQuestion.kind === 'find-bug' && currentQuestion.code) {
          const lineCount = currentQuestion.code.split('\n').length;
          const num = Number(e.key);
          if (Number.isInteger(num) && num >= 1 && num <= lineCount) {
            handleSelectBugLine(num);
          }
        }
      } else if (e.key === 'Enter' && !inInput) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage, currentQuestion, isAnswered, handleSelectChoice, handleSelectBugLine, handleNext]);

  const rank = getDeveloperRank(progress.xp);
  const xpInCurrentRank = progress.xp - rank.minXp;
  const xpSpan = rank.nextXp ? rank.nextXp - rank.minXp : 1;
  const dailyStreak = calculateDailyStreak(progress.activityByDate);
  const certEligibility = getCertificateEligibility(progress);

  // ===================== STAGE 1: SETUP =====================
  if (stage === 'setup') {
    const overallAccuracy =
      progress.totalAnswered > 0
        ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
        : 0;

    const cliPreview = `python3 pyterm.py --mode=${mode}${
      kindFilter !== 'all' ? ` --format=${kindFilter}` : ''
    }${topicFilter !== 'all' ? ` --topic=${topicFilter}` : ''} --tasks=${effectiveCount}`;

    const mistakesCount = progress.wrongQuestionIds.length;

    return (
      <section className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Launchpad & Quiz Configuration */}
          <div className="lg:col-span-8 rounded-lg border border-[#30363D] bg-[#161B22] p-6 sm:p-8 flex flex-col justify-between gap-7">
            <div className="space-y-6">
              {/* Terminal ASCII Graphic + Title + Sound Toggle */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <pre
                    className="font-mono text-[10px] sm:text-xs leading-tight text-[#3FB950] overflow-x-auto select-none"
                    aria-hidden="true"
                  >
                    {PYTHON_ASCII_ART}
                  </pre>
                  <button
                    type="button"
                    onClick={onToggleSound}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-[#8B949E] hover:text-[#E6EDF3] border border-[#30363D] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    aria-label={progress.soundEnabled ? 'Выключить звук' : 'Включить звук'}
                  >
                    {progress.soundEnabled ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-[#3FB950]" />
                        <span>Звук: Вкл</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        <span>Звук: Выкл</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-2">
                  <h1 className="font-mono text-2xl sm:text-3xl font-semibold text-[#E6EDF3] text-balance">
                    Интерактивный тренажёр по Python для 11–14 лет
                  </h1>
                  <p className="text-sm sm:text-base text-[#8B949E] leading-relaxed max-w-2xl">
                    42 задачи в трёх форматах — предсказание вывода, дополнение кода и поиск багов в отладчике — с пошаговой трассировкой переменных и синхронизацией прогресса с GitHub.
                  </p>
                </div>
              </div>

              {/* Mode Selector */}
              <div className="space-y-3">
                <div className="font-mono text-xs text-[#8B949E]">
                  1. Выбери режим и уровень сложности
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(
                    [
                      {
                        id: 'adaptive' as QuizMode,
                        title: 'Адаптивный',
                        meta: 'Умный подбор',
                        desc: 'Сложность автоматически растёт при сериях верных ответов.',
                      },
                      {
                        id: 'beginner' as QuizMode,
                        title: 'Базовый',
                        meta: '11–12 лет · +15–20 XP',
                        desc: DIFFICULTY_META.beginner.description,
                      },
                      {
                        id: 'intermediate' as QuizMode,
                        title: 'Средний',
                        meta: '12–13 лет · +25–30 XP',
                        desc: DIFFICULTY_META.intermediate.description,
                      },
                      {
                        id: 'advanced' as QuizMode,
                        title: 'Продвинутый',
                        meta: '13–14 лет · +40–45 XP',
                        desc: DIFFICULTY_META.advanced.description,
                      },
                      {
                        id: 'mixed' as QuizMode,
                        title: 'Смешанный',
                        meta: 'Все уровни',
                        desc: 'Задачи разной сложности и форматов вперемешку.',
                      },
                      {
                        id: 'mistakes' as QuizMode,
                        title: 'Работа над ошибками',
                        meta:
                          mistakesCount > 0
                            ? `${mistakesCount} в очереди`
                            : '0 ошибок',
                        desc:
                          mistakesCount > 0
                            ? 'Повторный разбор задач, в которых ранее была допущена ошибка.'
                            : 'Ошибок пока нет — пройди любой тест выше.',
                        disabled: mistakesCount === 0,
                      },
                    ]
                  ).map((item) => {
                    const active = mode === item.id;
                    const disabled = Boolean(item.disabled);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          setMode(item.id);
                          setTopicFilter('all');
                          setKindFilter('all');
                        }}
                        className={`text-left p-4 rounded-lg border transition-colors space-y-1.5 focus-visible:outline-2 focus-visible:outline-[#3FB950] ${
                          disabled
                            ? 'border-[#30363D]/50 bg-[#0D1117]/20 opacity-50 cursor-not-allowed'
                            : active
                              ? 'border-[#3FB950] bg-[#0D1117] cursor-pointer'
                              : 'border-[#30363D] bg-[#0D1117]/40 hover:border-[#484F58] cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-mono">
                          <span className="text-sm font-semibold text-[#E6EDF3] truncate">
                            {item.title}
                          </span>
                          <span
                            className={`text-[11px] whitespace-nowrap shrink-0 ${
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

              {/* Format Filter, Topic Filter & Question Count */}
              <div className="space-y-4 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="font-mono text-xs text-[#8B949E]">2. Формат заданий</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'all', label: 'Все форматы' },
                          { id: 'choice', label: 'Выбор ответа' },
                          { id: 'fill-blank', label: 'Дополни код' },
                          { id: 'find-bug', label: 'Найди баг' },
                        ] as Array<{ id: QuestionKind | 'all'; label: string }>
                      ).map((fmt) => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setKindFilter(fmt.id)}
                          className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                            kindFilter === fmt.id
                              ? 'bg-[#21262D] border-[#3FB950] text-[#E6EDF3]'
                              : 'bg-[#0D1117]/50 border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3]'
                          }`}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 shrink-0">
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

                <div className="space-y-2">
                  <div className="font-mono text-xs text-[#8B949E]">4. Тема задач</div>
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
                        (q) =>
                          (mode === 'mixed' ||
                            mode === 'adaptive' ||
                            (mode === 'mistakes'
                              ? progress.wrongQuestionIds.includes(q.id)
                              : q.difficulty === mode)) &&
                          (kindFilter === 'all' || q.kind === kindFilter) &&
                          q.topic === tid
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
                onClick={() => startQuiz()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-mono font-semibold bg-[#2EA043] hover:bg-[#3FB950] disabled:opacity-50 text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3FB950]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Начать тест ({effectiveCount})</span>
              </button>
            </div>
          </div>

          {/* Right: Student Form, Developer Profile & Certificate Status */}
          <aside className="lg:col-span-4 rounded-lg border border-[#30363D] bg-[#161B22] p-6 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              {/* Student Profile Form right before starting */}
              <StudentProfileForm
                profile={progress.studentProfile}
                onChange={onUpdateProfile}
                compact
              />

              <div className="space-y-2 pb-4 border-b border-[#30363D]">
                <div className="font-mono text-xs text-[#8B949E]">
                  Профиль разработчика · Уровень {rank.level}
                </div>
                <div className="font-mono text-xl font-semibold text-[#E6EDF3]">
                  {rank.title}
                </div>
                <div className="pt-1.5 space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs tabular-nums">
                    <span className="text-[#E3B341] font-medium">{progress.xp} XP</span>
                    <span className="text-[#8B949E]">
                      {rank.nextXp
                        ? `До след. уровня: ${rank.nextXp - progress.xp} XP`
                        : 'Максимальный ранг'}
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
                  <div className="text-xs text-[#8B949E]">Дней подряд</div>
                  <div className="text-xl font-semibold text-[#E3B341] tabular-nums">
                    {dailyStreak}
                  </div>
                </div>
              </div>

              {/* Certificate Progress Box */}
              <div className="pt-4 border-t border-[#30363D] space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8B949E]">Сертификат курса</span>
                  <span
                    className={
                      certEligibility.courseCompleted ? 'text-[#3FB950]' : 'text-[#E3B341]'
                    }
                  >
                    {certEligibility.courseCompleted
                      ? 'Открыт'
                      : `${certEligibility.solvedCount}/${CERTIFICATE_MIN_SOLVED} задач`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenCertificateTab}
                  className={`w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    certEligibility.courseCompleted
                      ? 'border-[#3FB950]/60 bg-[#2EA043]/15 text-[#3FB950] hover:bg-[#2EA043]/25'
                      : 'border-[#30363D] bg-[#0D1117] text-[#E6EDF3] hover:border-[#58A6FF]'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>
                    {certEligibility.courseCompleted
                      ? 'Открыть сертификат'
                      : 'Сертификат программиста'}
                  </span>
                </button>
              </div>
            </div>

            {/* Recent Session Snippet */}
            <div className="pt-4 border-t border-[#30363D] space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-[#8B949E]">
                <span>Достижения</span>
                <span className="text-[#E3B341] tabular-nums">
                  {progress.unlockedAchievements.length} / {ACHIEVEMENTS.length}
                </span>
              </div>
              {progress.sessions.length > 0 && (
                <div className="p-3 rounded-lg bg-[#0D1117] border border-[#30363D] flex items-center justify-between gap-2 tabular-nums">
                  <span className="text-[#8B949E] truncate">
                    {QUIZ_MODE_LABELS[progress.sessions[0].mode]}
                  </span>
                  <span className="text-[#3FB950] font-medium whitespace-nowrap">
                    {progress.sessions[0].score}/{progress.sessions[0].total} (
                    {progress.sessions[0].accuracy}%)
                  </span>
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
    const kindMeta = QUESTION_KIND_META[currentQuestion.kind];
    const lastAnswer = isAnswered ? answersLog[answersLog.length - 1] : null;
    const activeTraceLine =
      isAnswered && currentQuestion.trace && currentQuestion.trace[traceStepIndex]
        ? currentQuestion.trace[traceStepIndex].line
        : null;
    const comboLabel =
      sessionStreak >= 5 ? 'x1.5 XP' : sessionStreak >= 3 ? 'x1.25 XP' : null;

    return (
      <section className="space-y-6">
        {/* Session Status Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#30363D]">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs sm:text-sm text-[#8B949E] tabular-nums">
            <span className="text-[#E6EDF3] font-semibold">
              Задача {currentIndex + 1} / {targetTotal}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#58A6FF]">{kindMeta.label}</span>
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
              {comboLabel && <span className="text-[#E3B341] ml-1">({comboLabel})</span>}
            </span>
            <span className="text-[#8B949E]">
              Время: <strong className="text-[#E6EDF3]">{formatTimer(elapsedSec)}</strong>
            </span>
            <TerminalProgressBar
              value={currentIndex + (isAnswered ? 1 : 0)}
              max={targetTotal}
              segments={12}
              accent="emerald"
              label="Прогресс текущей викторины"
            />
            <button
              type="button"
              onClick={onToggleSound}
              aria-label={progress.soundEnabled ? 'Выключить звук' : 'Включить звук'}
              className="text-[#8B949E] hover:text-[#E6EDF3] cursor-pointer"
            >
              {progress.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#3FB950]" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
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
          {/* Left Zone: Interactive Code & Input */}
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 rounded-lg border border-[#30363D] bg-[#161B22] p-5 sm:p-6 space-y-5"
          >
            <div className="space-y-1.5">
              <h2 className="font-mono text-lg sm:text-xl font-semibold text-[#E6EDF3] leading-snug text-balance">
                {currentQuestion.prompt}
              </h2>
              <p className="font-mono text-xs text-[#8B949E]">{kindMeta.actionHint}</p>
            </div>

            {currentQuestion.code && (
              <PythonCodeBlock
                code={currentQuestion.code}
                filename={`task_${currentIndex + 1}.py`}
                activeLine={activeTraceLine}
                interactiveBugMode={currentQuestion.kind === 'find-bug'}
                selectedLine={selectedBugLine}
                buggyLine={currentQuestion.buggyLine}
                fixedLine={currentQuestion.fixedLine}
                revealed={isAnswered}
                onSelectLine={handleSelectBugLine}
                blankValue={currentQuestion.kind === 'fill-blank' ? blankInput : undefined}
                blankPlaceholder={currentQuestion.blankPlaceholder}
                blankState={
                  !isAnswered
                    ? 'idle'
                    : lastAnswer?.isCorrect
                      ? 'correct'
                      : 'wrong'
                }
              />
            )}

            {/* FORMAT 1: Multiple Choice */}
            {currentQuestion.kind === 'choice' && currentQuestion.options && (
              <div className="space-y-2.5 pt-1" role="group" aria-label="Варианты ответа">
                {currentQuestion.options.map((option, idx) => {
                  const isSelected = selectedChoiceIdx === idx;
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
                      onClick={() => handleSelectChoice(idx)}
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
            )}

            {/* FORMAT 2: Interactive Fill-in-the-Blank Editor */}
            {currentQuestion.kind === 'fill-blank' && (
              <div className="space-y-4 pt-1">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmitBlank();
                  }}
                  className="flex flex-col sm:flex-row gap-2.5"
                >
                  <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-[#30363D] bg-[#0D1117] focus-within:border-[#58A6FF]">
                    <span className="font-mono text-xs text-[#3FB950] select-none">&gt;&gt;&gt;</span>
                    <input
                      ref={blankInputRef}
                      type="text"
                      disabled={isAnswered}
                      value={blankInput}
                      onChange={(e) => setBlankInput(e.target.value)}
                      placeholder={`Впиши ${currentQuestion.blankPlaceholder || 'код'}...`}
                      spellCheck={false}
                      autoComplete="off"
                      className="w-full bg-transparent font-mono text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none disabled:opacity-70"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isAnswered || !blankInput.trim()}
                    className="px-5 py-2.5 text-sm font-mono font-semibold bg-[#2EA043] hover:bg-[#3FB950] disabled:opacity-40 text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Запустить код
                  </button>
                </form>

                {currentQuestion.options && !isAnswered && (
                  <div className="space-y-2">
                    <div className="font-mono text-xs text-[#8B949E]">
                      Или выбери готовый токен:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {currentQuestion.options.map((tok) => (
                        <button
                          key={tok}
                          type="button"
                          onClick={() => handleSubmitBlank(tok)}
                          className="px-3 py-2.5 font-mono text-sm rounded-lg border border-[#30363D] bg-[#0D1117] hover:border-[#58A6FF] hover:bg-[#1C2128] text-[#E6EDF3] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {tok}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isAnswered && lastAnswer && !lastAnswer.isCorrect && (
                  <div className="font-mono text-xs text-[#3FB950]">
                    Правильный фрагмент:{' '}
                    <code className="px-2 py-0.5 rounded bg-[#0D1117] border border-[#3FB950]/50">
                      {lastAnswer.correctAnswerLabel}
                    </code>
                  </div>
                )}
              </div>
            )}

            {/* FORMAT 3: Find-Bug Keyboard Helper */}
            {currentQuestion.kind === 'find-bug' && !isAnswered && currentQuestion.code && (
              <div className="font-mono text-xs text-[#8B949E]">
                Кликни по любой строке кода выше или нажми цифру от 1 до{' '}
                {currentQuestion.code.split('\n').length} на клавиатуре.
              </div>
            )}

            {/* Next Action */}
            {isAnswered && (
              <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-[#30363D]">
                <span className="font-mono text-xs text-[#58A6FF]">
                  {adaptiveNotice ?? 'Нажми Enter для перехода дальше'}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 text-sm font-mono font-semibold bg-[#2EA043] hover:bg-[#3FB950] text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3FB950]"
                >
                  <span>
                    {currentIndex + 1 < targetTotal ? 'Следующий вопрос' : 'Показать итоги'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>

          {/* Right Zone: Python REPL, Step-by-Step Debugger & Detailed Explanation */}
          <aside className="lg:col-span-5 rounded-lg border border-[#30363D] bg-[#161B22] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#30363D] bg-[#0D1117] flex items-center justify-between font-mono text-xs text-[#8B949E]">
              <span className="inline-flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-[#3FB950]" />
                <span>Консоль разбора и отладчик</span>
              </span>
              <span>Python 3.12</span>
            </div>

            {!isAnswered ? (
              <div className="p-5 sm:p-6 space-y-5">
                <div className="font-mono text-xs text-[#8B949E] leading-relaxed">
                  <span className="text-[#3FB950]">$</span> python3 task_{currentIndex + 1}.py
                  <div className="mt-2 text-[#6E7681]">
                    Ожидание решения... После ответа здесь откроется вывод терминала,{' '}
                    {currentQuestion.trace
                      ? 'пошаговая трассировка переменных '
                      : ''}
                    и подробный разбор.
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
                  <div>
                    {currentQuestion.kind === 'choice'
                      ? 'Клавиши 1–4 — быстрый выбор ответа'
                      : currentQuestion.kind === 'fill-blank'
                        ? 'Enter — запустить код после ввода'
                        : 'Цифра строки или клик — указать баг'}
                  </div>
                  <div>Клавиша Enter после ответа — далее</div>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="p-5 sm:p-6 space-y-5"
              >
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
                          <span>Ошибка — разберёмся</span>
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

                {/* Simulated Terminal Output */}
                <div className="rounded-lg bg-[#0D1117] border border-[#30363D] p-3.5 font-mono text-xs sm:text-sm space-y-1.5">
                  <div className="text-[#8B949E]">
                    <span className="text-[#3FB950]">$</span> python3 task_{currentIndex + 1}.py
                  </div>
                  <div
                    className={
                      currentQuestion.terminalOutput.includes('Error') ||
                      currentQuestion.terminalOutput.includes('Бесконечный')
                        ? 'text-[#F85149]'
                        : 'text-[#E6EDF3]'
                    }
                  >
                    {currentQuestion.terminalOutput}
                  </div>
                </div>

                {/* Step-by-Step Execution Trace Visualizer */}
                {currentQuestion.trace && currentQuestion.trace.length > 0 && (
                  <ExecutionTracePanel
                    trace={currentQuestion.trace}
                    stepIndex={traceStepIndex}
                    onStepChange={(next) => {
                      setTraceStepIndex(next);
                      if (progress.soundEnabled) playStepTick();
                    }}
                  />
                )}

                {/* Explanation */}
                <div className="space-y-1.5">
                  <h3 className="font-mono text-xs font-semibold text-[#8B949E]">
                    Почему это работает так
                  </h3>
                  <p className="text-sm text-[#E6EDF3] leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>

                {/* Developer Tip */}
                <div className="rounded-lg border border-[#30363D] bg-[#0D1117] p-3.5 space-y-1">
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
  const missedCount = totalCount - correctCount;

  return (
    <section className="space-y-8">
      <div className="rounded-lg border border-[#30363D] bg-[#161B22] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#30363D]">
          <div className="space-y-2">
            <div className="font-mono text-xs text-[#3FB950]">
              Сессия завершена · {QUIZ_MODE_LABELS[mode]}
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
            {certEligibility.courseCompleted && (
              <button
                type="button"
                onClick={onOpenCertificateTab}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-mono font-medium text-[#E3B341] border border-[#E3B341]/60 bg-[#E3B341]/10 hover:bg-[#E3B341]/20 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Award className="w-4 h-4" />
                <span>Получить сертификат</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => startQuiz()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-mono font-semibold bg-[#2EA043] hover:bg-[#3FB950] text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Пройти ещё раз</span>
            </button>

            {missedCount > 0 && progress.wrongQuestionIds.length > 0 && (
              <button
                type="button"
                onClick={() => startQuiz('mistakes')}
                className="px-4 py-2.5 text-sm font-mono text-[#E3B341] border border-[#E3B341]/50 hover:bg-[#E3B341]/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Исправить ошибки ({progress.wrongQuestionIds.length})
              </button>
            )}

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
              className="px-3.5 py-2.5 text-sm font-mono text-[#8B949E] hover:text-[#E6EDF3] transition-colors cursor-pointer whitespace-nowrap"
            >
              Настройки
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
              {achBonusXp > 0 ? `вкл. +${achBonusXp} за значки` : 'с учётом комбо'}
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
        <div className="px-6 py-4 border-b border-[#30363D] flex flex-wrap items-center justify-between gap-2">
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
              <div key={`${entry.question.id}-${idx}`}>
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
                    <span className="hidden sm:inline font-mono text-xs text-[#58A6FF] shrink-0">
                      {QUESTION_KIND_META[entry.question.kind].label}
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
                      <PythonCodeBlock
                        code={entry.question.code}
                        filename={`review_${idx + 1}.py`}
                        interactiveBugMode={entry.question.kind === 'find-bug'}
                        buggyLine={entry.question.buggyLine}
                        fixedLine={entry.question.fixedLine}
                        revealed={true}
                      />
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                      <div className="p-3 rounded border border-[#30363D] bg-[#161B22]">
                        <div className="text-[#8B949E] mb-1">Твой ответ</div>
                        <div className={entry.isCorrect ? 'text-[#3FB950]' : 'text-[#F85149]'}>
                          {entry.userAnswerLabel}
                        </div>
                      </div>
                      <div className="p-3 rounded border border-[#30363D] bg-[#161B22]">
                        <div className="text-[#8B949E] mb-1">Правильный ответ</div>
                        <div className="text-[#3FB950]">{entry.correctAnswerLabel}</div>
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
