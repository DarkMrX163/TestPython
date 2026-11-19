import { CheckCircle2, Lock } from 'lucide-react';
import { useState } from 'react';
import { ACHIEVEMENTS } from '../data/achievements';
import type { UserProgress } from '../types';
import { TerminalProgressBar } from './TerminalProgressBar';

interface AchievementsViewProps {
  progress: UserProgress;
  onStartQuiz: () => void;
}

type FilterMode = 'all' | 'unlocked' | 'locked';

export function AchievementsView({ progress, onStartQuiz }: AchievementsViewProps) {
  const [filter, setFilter] = useState<FilterMode>('all');

  const unlockedSet = new Set(progress.unlockedAchievements);
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id)).length;
  const totalBonusXp = ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id)).reduce(
    (sum, a) => sum + a.xpReward,
    0
  );

  const visibleAchievements = ACHIEVEMENTS.filter((a) => {
    const isUnlocked = unlockedSet.has(a.id);
    if (filter === 'unlocked') return isUnlocked;
    if (filter === 'locked') return !isUnlocked;
    return true;
  });

  return (
    <section className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#30363D]">
        <div className="space-y-2 max-w-2xl">
          <h1 className="font-mono text-2xl sm:text-3xl font-semibold text-[#E6EDF3] text-balance">
            Достижения разработчика
          </h1>
          <p className="text-sm sm:text-base text-[#8B949E] leading-relaxed">
            Открывай значки за серии верных ответов, безупречные прохождения и освоение новых тем Python. Каждое достижение приносит дополнительный опыт XP.
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <div className="flex items-center gap-2 font-mono text-xs text-[#8B949E] tabular-nums">
            <span>
              Открыто: <strong className="text-[#E6EDF3]">{unlockedCount}</strong> / {ACHIEVEMENTS.length}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Бонус: <strong className="text-[#E3B341]">+{totalBonusXp} XP</strong>
            </span>
          </div>
          <TerminalProgressBar
            value={unlockedCount}
            max={ACHIEVEMENTS.length}
            segments={18}
            accent="gold"
            label="Прогресс достижений"
          />
        </div>
      </div>

      {/* Interactive Filter Segmented Control */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#161B22] border border-[#30363D]">
          {(
            [
              { id: 'all', label: `Все (${ACHIEVEMENTS.length})` },
              { id: 'unlocked', label: `Открытые (${unlockedCount})` },
              { id: 'locked', label: `В процессе (${ACHIEVEMENTS.length - unlockedCount})` },
            ] as Array<{ id: FilterMode; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-2 text-xs font-mono rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? 'bg-[#21262D] text-[#E6EDF3]'
                  : 'text-[#8B949E] hover:text-[#E6EDF3]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {unlockedCount === 0 && (
          <button
            type="button"
            onClick={onStartQuiz}
            className="px-4 py-2 text-sm font-mono font-medium bg-[#2EA043] hover:bg-[#3FB950] text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Открыть первое достижение
          </button>
        )}
      </div>

      {visibleAchievements.length === 0 ? (
        <div className="rounded-lg border border-[#30363D] bg-[#161B22] p-10 text-center space-y-4">
          <p className="font-mono text-base text-[#E6EDF3]">
            {filter === 'unlocked'
              ? 'Пока нет открытых достижений'
              : 'Поздравляем! Все достижения уже открыты'}
          </p>
          <p className="text-sm text-[#8B949E] max-w-md mx-auto">
            {filter === 'unlocked'
              ? 'Пройди первую викторину, чтобы получить значок «Первый запуск» и бонусный опыт.'
              : 'Ты прошёл все испытания PyTerm и доказал, что отлично разбираешься в Python.'}
          </p>
          {filter === 'unlocked' && (
            <button
              type="button"
              onClick={onStartQuiz}
              className="px-5 py-2.5 text-sm font-mono font-medium bg-[#2EA043] hover:bg-[#3FB950] text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Перейти к викторине
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleAchievements.map((ach) => {
            const unlocked = unlockedSet.has(ach.id);
            return (
              <article
                key={ach.id}
                className={`rounded-lg border p-5 flex flex-col justify-between gap-4 transition-colors ${
                  unlocked
                    ? 'border-[#3FB950]/50 bg-[#161B22]'
                    : 'border-[#30363D] bg-[#161B22]/60'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`font-mono text-sm font-semibold tracking-tight ${
                        unlocked ? 'text-[#E3B341]' : 'text-[#6E7681]'
                      }`}
                    >
                      {ach.asciiArt}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 font-mono text-xs whitespace-nowrap shrink-0 ${
                        unlocked ? 'text-[#3FB950]' : 'text-[#6E7681]'
                      }`}
                    >
                      {unlocked ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Открыто</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Закрыто</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="font-mono text-base font-semibold text-[#E6EDF3]">
                      {ach.title}
                    </h2>
                    <p className="text-sm text-[#8B949E] leading-relaxed">{ach.description}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#30363D] flex items-center justify-between font-mono text-xs text-[#8B949E] tabular-nums">
                  <span>{ach.requirementLabel}</span>
                  <span className={unlocked ? 'text-[#E3B341]' : 'text-[#6E7681]'}>
                    +{ach.xpReward} XP
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
