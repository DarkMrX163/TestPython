import { RotateCcw, Trophy } from 'lucide-react';
import { useState } from 'react';
import { ACHIEVEMENTS, DEVELOPER_RANKS, getDeveloperRank } from '../data/achievements';
import { DIFFICULTY_META, QUESTIONS, QUIZ_MODE_LABELS, TOPIC_META } from '../data/questions';
import type { Difficulty, TopicId, UserProgress } from '../types';
import { ActivityHeatmap } from './ActivityHeatmap';
import { TerminalProgressBar } from './TerminalProgressBar';

interface ProgressDashboardProps {
  progress: UserProgress;
  onStartQuiz: () => void;
  onPracticeMistakes: () => void;
  onResetProgress: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ProgressDashboard({
  progress,
  onStartQuiz,
  onPracticeMistakes,
  onResetProgress,
}: ProgressDashboardProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  const rank = getDeveloperRank(progress.xp);
  const overallAccuracy =
    progress.totalAnswered > 0
      ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
      : 0;

  const uniqueSolvedCount = progress.correctQuestionIds.length;
  const totalQuestionsBank = QUESTIONS.length;
  const mistakesCount = progress.wrongQuestionIds.length;

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#30363D]">
        <div className="space-y-2 max-w-2xl">
          <h1 className="font-mono text-2xl sm:text-3xl font-semibold text-[#E6EDF3] text-balance">
            Прогресс обучения
          </h1>
          <p className="text-sm sm:text-base text-[#8B949E]">
            Календарь практики, статистика по темам, уровням сложности и журнал тренировок.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {mistakesCount > 0 && (
            <button
              type="button"
              onClick={onPracticeMistakes}
              className="px-4 py-2 text-xs font-mono font-medium bg-[#E3B341]/15 text-[#E3B341] border border-[#E3B341]/50 hover:bg-[#E3B341]/25 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Разобрать ошибки ({mistakesCount})
            </button>
          )}

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-mono text-[#8B949E] hover:text-[#F85149] border border-[#30363D] hover:border-[#F85149]/50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сбросить прогресс</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetProgress();
                  setConfirmReset(false);
                }}
                className="px-3.5 py-2 text-xs font-mono font-medium bg-[#F85149] text-[#0D1117] rounded-lg hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
              >
                Подтвердить сброс
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-2 text-xs font-mono text-[#8B949E] hover:text-[#E6EDF3] border border-[#30363D] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4-column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#30363D] rounded-lg bg-[#161B22] divide-y lg:divide-y-0 lg:divide-x divide-[#30363D]">
        <div className="p-5 space-y-1.5">
          <div className="font-mono text-xs text-[#8B949E]">Накопленный опыт</div>
          <div className="font-mono text-2xl sm:text-3xl font-semibold text-[#E3B341] tabular-nums">
            {progress.xp} XP
          </div>
          <div className="font-mono text-xs text-[#8B949E]">
            Уровень {rank.level} · {rank.title}
          </div>
        </div>

        <div className="p-5 space-y-1.5">
          <div className="font-mono text-xs text-[#8B949E]">Общая точность</div>
          <div className="font-mono text-2xl sm:text-3xl font-semibold text-[#3FB950] tabular-nums">
            {overallAccuracy}%
          </div>
          <div className="font-mono text-xs text-[#8B949E] tabular-nums">
            {progress.totalCorrect} из {progress.totalAnswered} ответов
          </div>
        </div>

        <div className="p-5 space-y-1.5">
          <div className="font-mono text-xs text-[#8B949E]">Уникальных задач</div>
          <div className="font-mono text-2xl sm:text-3xl font-semibold text-[#58A6FF] tabular-nums">
            {uniqueSolvedCount} / {totalQuestionsBank}
          </div>
          <div className="font-mono text-xs text-[#8B949E] tabular-nums">
            Багов: {progress.bugFixedCount} · Кода: {progress.fillBlankCorrectCount}
          </div>
        </div>

        <div className="p-5 space-y-1.5">
          <div className="font-mono text-xs text-[#8B949E]">Лучшая серия</div>
          <div className="font-mono text-2xl sm:text-3xl font-semibold text-[#E6EDF3] tabular-nums">
            {progress.bestStreak}
          </div>
          <div className="font-mono text-xs text-[#8B949E] tabular-nums">
            Достижений: {progress.unlockedAchievements.length} / {ACHIEVEMENTS.length}
          </div>
        </div>
      </div>

      {/* GitHub-Style Activity Heatmap */}
      <ActivityHeatmap activityByDate={progress.activityByDate} />

      {/* Two-Column Breakdown: Topics + Levels & Ranks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Topic Mastery */}
        <div className="lg:col-span-7 rounded-lg border border-[#30363D] bg-[#161B22] p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-mono text-base font-semibold text-[#E6EDF3]">
              Освоение тем Python
            </h2>
            <span className="font-mono text-xs text-[#8B949E]">Точность по темам</span>
          </div>

          <div className="divide-y divide-[#30363D]">
            {(Object.keys(TOPIC_META) as TopicId[]).map((topicId) => {
              const stat = progress.topicStats[topicId] || { answered: 0, correct: 0 };
              const acc = stat.answered > 0 ? Math.round((stat.correct / stat.answered) * 100) : 0;

              return (
                <div
                  key={topicId}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-mono text-sm text-[#E6EDF3]">
                      {TOPIC_META[topicId].label}
                    </div>
                    <div className="font-mono text-xs text-[#8B949E] tabular-nums">
                      {stat.answered > 0
                        ? `Верно ${stat.correct} из ${stat.answered}`
                        : 'Ещё нет ответов'}
                    </div>
                  </div>
                  <TerminalProgressBar
                    value={acc}
                    max={100}
                    segments={14}
                    accent={acc >= 75 ? 'emerald' : acc >= 40 ? 'gold' : 'sky'}
                    label={`Точность по теме ${TOPIC_META[topicId].label}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Difficulty Levels & Developer Rank Ladder */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-lg border border-[#30363D] bg-[#161B22] p-6 space-y-5">
            <h2 className="font-mono text-base font-semibold text-[#E6EDF3]">
              Уровни сложности
            </h2>
            <div className="space-y-4">
              {(['beginner', 'intermediate', 'advanced'] as Difficulty[]).map((diff) => {
                const meta = DIFFICULTY_META[diff];
                const stat = progress.difficultyStats[diff] || { answered: 0, correct: 0 };
                const totalInDiff = QUESTIONS.filter((q) => q.difficulty === diff).length;
                const solvedInDiff = progress.correctQuestionIds.filter((id) =>
                  QUESTIONS.some((q) => q.id === id && q.difficulty === diff)
                ).length;

                return (
                  <div key={diff} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 font-mono text-xs">
                      <span className="text-[#E6EDF3] font-medium">
                        {meta.label}{' '}
                        <span className="text-[#8B949E] font-normal">· {meta.ageRange}</span>
                      </span>
                      <span className="text-[#8B949E] tabular-nums">
                        {solvedInDiff}/{totalInDiff} задач ·{' '}
                        {stat.answered > 0 ? Math.round((stat.correct / stat.answered) * 100) : 0}%
                      </span>
                    </div>
                    <TerminalProgressBar
                      value={solvedInDiff}
                      max={totalInDiff}
                      segments={18}
                      accent={
                        diff === 'beginner'
                          ? 'emerald'
                          : diff === 'intermediate'
                            ? 'sky'
                            : 'gold'
                      }
                      label={`Прогресс уровня ${meta.label}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-[#30363D] bg-[#161B22] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-base font-semibold text-[#E6EDF3]">
                Шкала рангов
              </h2>
              <Trophy className="w-4 h-4 text-[#E3B341]" aria-hidden="true" />
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              {DEVELOPER_RANKS.map((r) => {
                const reached = progress.xp >= r.minXp;
                const isCurrent = rank.level === r.level;
                return (
                  <div
                    key={r.level}
                    className={`flex items-center justify-between py-1.5 px-2.5 rounded ${
                      isCurrent
                        ? 'bg-[#21262D] text-[#E6EDF3]'
                        : reached
                          ? 'text-[#8B949E]'
                          : 'text-[#6E7681]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={isCurrent ? 'text-[#3FB950]' : 'text-[#484F58]'}>
                        {isCurrent ? '→' : reached ? '✓' : '·'}
                      </span>
                      <span>
                        Ур.{r.level} {r.title}
                      </span>
                    </span>
                    <span className="tabular-nums">{r.minXp} XP</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Session History Table */}
      <div className="rounded-lg border border-[#30363D] bg-[#161B22] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#30363D] flex items-center justify-between gap-4">
          <h2 className="font-mono text-base font-semibold text-[#E6EDF3]">
            Журнал тренировок
          </h2>
          <span className="font-mono text-xs text-[#8B949E] tabular-nums">
            Всего сессий: {progress.sessions.length}
          </span>
        </div>

        {progress.sessions.length === 0 ? (
          <div className="p-10 text-center space-y-4">
            <p className="font-mono text-sm text-[#E6EDF3]">Журнал пока пуст</p>
            <p className="text-sm text-[#8B949E] max-w-md mx-auto">
              Пройди свою первую викторину по Python, и здесь появятся результаты, точность, время и полученный опыт.
            </p>
            <button
              type="button"
              onClick={onStartQuiz}
              className="px-5 py-2.5 text-sm font-mono font-medium bg-[#2EA043] hover:bg-[#3FB950] text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Начать первую викторину
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#30363D] text-[#8B949E] bg-[#0D1117]/50">
                  <th className="py-3 px-6 font-medium">Дата</th>
                  <th className="py-3 px-4 font-medium">Режим</th>
                  <th className="py-3 px-4 font-medium text-right">Верно</th>
                  <th className="py-3 px-4 font-medium text-right">Точность</th>
                  <th className="py-3 px-4 font-medium text-right">Серия</th>
                  <th className="py-3 px-4 font-medium text-right">Время</th>
                  <th className="py-3 px-6 font-medium text-right">Опыт</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363D] tabular-nums">
                {progress.sessions.slice(0, 15).map((session) => {
                  const dateLabel = new Date(session.date).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={session.id} className="hover:bg-[#21262D]/50 transition-colors">
                      <td className="py-3 px-6 text-[#8B949E] whitespace-nowrap">{dateLabel}</td>
                      <td className="py-3 px-4 text-[#E6EDF3] whitespace-nowrap">
                        {QUIZ_MODE_LABELS[session.mode] || session.mode}
                      </td>
                      <td className="py-3 px-4 text-right text-[#E6EDF3]">
                        {session.score}/{session.total}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-medium ${
                          session.accuracy >= 80
                            ? 'text-[#3FB950]'
                            : session.accuracy >= 50
                              ? 'text-[#E3B341]'
                              : 'text-[#F85149]'
                        }`}
                      >
                        {session.accuracy}%
                      </td>
                      <td className="py-3 px-4 text-right text-[#8B949E]">{session.bestStreak}</td>
                      <td className="py-3 px-4 text-right text-[#8B949E]">
                        {formatDuration(session.durationSec)}
                      </td>
                      <td className="py-3 px-6 text-right text-[#E3B341]">
                        +{session.xpEarned} XP
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
